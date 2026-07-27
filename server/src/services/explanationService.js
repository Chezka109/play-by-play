const crypto = require('crypto');
const OpenAI = require('openai');
const {
    toResponseInputItems,
} = require('openai/lib/responses/ResponseInputItems');

const { env } = require('../config/env');
const { TtlCache } = require('./cache');
const {
    inspectPlay,
    lookupFootballTerms,
} = require('./footballKnowledge');

const cache = new TtlCache({
    maxSize: 8000,
    ttlMs: 1000 * 60 * 60 * 24 * 30,
});
const inFlight = new Map();

const EXPLANATION_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        result: { type: 'string' },
        whyItMatters: { type: 'string' },
        strategy: { type: 'string' },
        concepts: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    term: { type: 'string' },
                    definition: { type: 'string' },
                },
                required: ['term', 'definition'],
            },
        },
        watchFor: { type: 'string' },
        confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
        },
    },
    required: [
        'headline',
        'summary',
        'result',
        'whyItMatters',
        'strategy',
        'concepts',
        'watchFor',
        'confidence',
    ],
};

const AGENT_TOOLS = [
    {
        type: 'function',
        name: 'inspect_play',
        description:
            'Parse the play and return trusted game-situation facts, recent-play context, and relevant glossary definitions.',
        strict: true,
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                focus: {
                    type: 'string',
                    enum: ['result', 'strategy', 'rules', 'full'],
                },
            },
            required: ['focus'],
        },
    },
    {
        type: 'function',
        name: 'define_football_terms',
        description:
            'Return trusted beginner-friendly definitions for requested American football terms.',
        strict: true,
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                terms: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
            required: ['terms'],
        },
    },
];

const AGENT_INSTRUCTIONS = `You are Field Guide, a live American-football explanation agent.

Explain the supplied play for the requested audience. Ground every claim in the play, game situation, recent plays, or tool evidence. Distinguish an observed fact from a likely strategic purpose. Never invent formations, player intent, coverage, injuries, or win probability.

Lead with what happened. Explain why it matters for the current down, distance, possession, score, or field position when those facts are available. If context is missing, say so briefly instead of guessing. Use plain language. Define at most three genuinely useful terms, using only definitions returned by a tool. Keep each field compact and actionable.`;

function safeString(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function normalizeRequest(input) {
    const raw = typeof input === 'string' ? { play: { text: input } } : input || {};
    const play = raw.play || { text: raw.text };
    const text = safeString(play?.text);

    if (!text) throw new Error('Play text is required');
    if (text.length > 1500) throw new Error('Play text is too long');

    return {
        play: {
            ...play,
            text,
        },
        recentPlays: Array.isArray(raw.recentPlays) ? raw.recentPlays.slice(-8) : [],
        game: raw.game && typeof raw.game === 'object' ? raw.game : null,
        audience: ['rookie', 'fan', 'coach'].includes(raw.audience)
            ? raw.audience
            : 'rookie',
        safetyIdentifier: raw.safetyIdentifier || null,
    };
}

function cacheKeyFor(request) {
    const context = {
        play: request.play,
        recentPlays: request.recentPlays.map((play) => ({
            id: play.id,
            text: play.text,
            down: play.down,
            distance: play.distance,
            quarter: play.quarter,
            clock: play.clock,
        })),
        game: request.game,
        audience: request.audience,
        model: env.openaiModel,
    };
    return crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex');
}

function fallbackSummary(facts) {
    const parsed = facts.parsed || {};
    const yards = Number.isFinite(parsed.yards) ? parsed.yards : null;

    if (parsed.type === 'incomplete') {
        return 'The quarterback threw the ball toward a teammate, but the pass was not caught, so the ball returns to the previous spot.';
    }
    if (parsed.type === 'interception') {
        return 'The quarterback’s pass was caught by a defender, giving the other team the ball.';
    }
    if (parsed.type === 'sack') {
        return 'A defender tackled the quarterback behind the starting line before a pass was thrown.';
    }
    if (parsed.type === 'penalty') {
        return 'The officials called a rule violation and adjusted or erased the result of the play.';
    }
    if (parsed.type === 'rush') {
        if (yards === 0) return 'The offense ran the ball, but the runner did not gain any ground.';
        if (yards != null) {
            return `The offense ran the ball and ${yards > 0 ? `gained ${yards}` : `lost ${Math.abs(yards)}`} yard${Math.abs(yards) === 1 ? '' : 's'}.`;
        }
        return 'The offense handed or kept the ball for a run.';
    }
    if (parsed.type === 'pass') {
        if (yards != null) {
            return `The quarterback completed a pass and the offense gained ${yards} yard${Math.abs(yards) === 1 ? '' : 's'}.`;
        }
        return 'The quarterback completed a pass to a teammate.';
    }
    return 'The offense ran a play, but the available description does not show enough detail for a more specific explanation.';
}

function fallbackWhyItMatters(facts) {
    const parsed = facts.parsed || {};
    const situation = facts.situation || {};

    if (parsed.touchdown) return 'The play produced a touchdown, worth six points before the try.';
    if (parsed.type === 'interception' || /fumble/i.test(parsed.raw || '')) {
        return 'Possession changes, so the opposing offense gets the next chance with the ball.';
    }
    if (
        Number.isFinite(parsed.yards) &&
        Number.isFinite(Number(situation.distance)) &&
        parsed.yards >= Number(situation.distance)
    ) {
        return 'The gain appears large enough to earn a new set of downs.';
    }
    if (situation.down != null && situation.distance != null) {
        return `This changes what the offense needs after starting at ${situation.down}${ordinal(situation.down)} down with ${situation.distance} yard${Number(situation.distance) === 1 ? '' : 's'} to go.`;
    }
    return 'The play changes the offense’s field position or its next down, but the feed does not include enough context to be more precise.';
}

function ordinal(number) {
    const value = Number(number);
    if (value === 1) return 'st';
    if (value === 2) return 'nd';
    if (value === 3) return 'rd';
    return 'th';
}

function fallbackStrategy(facts) {
    const type = facts.parsed?.type;
    if (type === 'rush') {
        return 'A run can gain steady yards, keep the clock moving, and make the next down easier.';
    }
    if (type === 'pass') {
        return 'A completed pass moves the ball through the air, often trading more potential yardage for more risk than a short run.';
    }
    if (type === 'incomplete') {
        return 'The passing attempt created no gain; the clock normally stops and the offense uses a down.';
    }
    if (type === 'sack') {
        return 'The defense prevented a throw and pushed the offense backward.';
    }
    if (type === 'interception') {
        return 'The defense took advantage of the passing risk and ended the offense’s possession.';
    }
    if (type === 'penalty') {
        return 'The rule violation can change the down, distance, or result, so the official enforcement matters more than the action before the flag.';
    }
    return 'The feed does not identify enough tactical detail to explain the play call without guessing.';
}

function fallbackHeadline(facts) {
    if (facts.parsed?.touchdown) return 'Touchdown for the offense';
    const headlines = {
        pass: 'Completed pass moves the ball',
        incomplete: 'Pass falls incomplete',
        interception: 'Defense intercepts the pass',
        rush: 'Offense runs the ball',
        sack: 'Defense sacks the quarterback',
        penalty: 'Penalty changes the play',
    };
    return headlines[facts.parsed?.type] || 'Play result';
}

function createFallbackExplanation(request) {
    const facts = inspectPlay(request);
    const parsed = facts.parsed || {};
    const concepts = facts.glossary.slice(0, 3);

    return {
        headline: fallbackHeadline(facts),
        summary: fallbackSummary(facts),
        result: safeString(request.play.text),
        whyItMatters: fallbackWhyItMatters(facts),
        strategy: fallbackStrategy(facts),
        concepts,
        watchFor:
            parsed.type === 'unknown'
                ? 'Watch the down, distance, and official spot to see the exact outcome.'
                : 'Watch where the ball is spotted and what down the offense faces next.',
        confidence: parsed.type === 'unknown' ? 'low' : 'high',
        text: fallbackSummary(facts),
    };
}

function normalizeExplanation(value, request) {
    const fallback = createFallbackExplanation(request);
    const concepts = Array.isArray(value?.concepts)
        ? value.concepts
              .slice(0, 3)
              .map((concept) => ({
                  term: safeString(concept?.term),
                  definition: safeString(concept?.definition),
              }))
              .filter((concept) => concept.term && concept.definition)
        : fallback.concepts;

    const explanation = {
        headline: safeString(value?.headline, fallback.headline),
        summary: safeString(value?.summary, fallback.summary),
        result: safeString(value?.result, fallback.result),
        whyItMatters: safeString(value?.whyItMatters, fallback.whyItMatters),
        strategy: safeString(value?.strategy, fallback.strategy),
        concepts,
        watchFor: safeString(value?.watchFor, fallback.watchFor),
        confidence: ['high', 'medium', 'low'].includes(value?.confidence)
            ? value.confidence
            : fallback.confidence,
    };

    return { ...explanation, text: explanation.summary };
}

function executeTool(call, request) {
    let args = {};
    try {
        args = JSON.parse(call.arguments || '{}');
    } catch {
        return { error: 'Invalid JSON tool arguments' };
    }

    if (call.name === 'inspect_play') {
        return {
            focus: args.focus,
            evidence: inspectPlay(request),
        };
    }
    if (call.name === 'define_football_terms') {
        return {
            definitions: lookupFootballTerms(args.terms, { limit: 6 }),
        };
    }
    return { error: `Unknown tool: ${call.name}` };
}

async function runOpenAIAgent(request, client) {
    const userInput = {
        audience: request.audience,
        play: request.play,
        recentPlays: request.recentPlays,
        game: request.game,
    };
    const input = [
        {
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: `Analyze this play using the available evidence tools.\n${JSON.stringify(userInput)}`,
                },
            ],
        },
    ];

    for (let round = 0; round <= env.openaiMaxToolRounds; round += 1) {
        const response = await client.responses.create({
            model: env.openaiModel,
            instructions: AGENT_INSTRUCTIONS,
            input,
            include: ['reasoning.encrypted_content'],
            max_output_tokens: env.openaiMaxOutputTokens,
            reasoning: { effort: env.openaiReasoningEffort },
            store: false,
            text: {
                verbosity: 'low',
                format: {
                    type: 'json_schema',
                    name: 'football_play_explanation',
                    strict: true,
                    schema: EXPLANATION_SCHEMA,
                },
            },
            tools: AGENT_TOOLS,
            tool_choice:
                round === 0
                    ? { type: 'function', name: 'inspect_play' }
                    : round === env.openaiMaxToolRounds
                      ? 'none'
                      : 'auto',
            parallel_tool_calls: true,
            prompt_cache_key: 'play-by-play-field-guide-v1',
            safety_identifier: request.safetyIdentifier || undefined,
        });

        const calls = (response.output || []).filter(
            (item) => item.type === 'function_call'
        );

        if (calls.length === 0) {
            if (!response.output_text) throw new Error('OpenAI returned no explanation');
            return normalizeExplanation(JSON.parse(response.output_text), request);
        }

        if (round === env.openaiMaxToolRounds) {
            throw new Error('Explanation agent exceeded its tool-call limit');
        }

        input.push(...toResponseInputItems(response.output));
        for (const call of calls) {
            input.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: JSON.stringify(executeTool(call, request)),
            });
        }
    }

    throw new Error('Explanation agent did not produce a final answer');
}

function makeOpenAIClient() {
    if (!env.openaiApiKey) return null;
    return new OpenAI({
        apiKey: env.openaiApiKey,
        timeout: env.openaiTimeoutMs,
        maxRetries: 2,
    });
}

function createExplanationService({ client = makeOpenAIClient() } = {}) {
    return {
        async explain(input, { force = false } = {}) {
            const request = normalizeRequest(input);
            const key = cacheKeyFor(request);

            if (!force) {
                const cached = cache.get(key);
                if (cached) {
                    return {
                        ...cached,
                        meta: { ...cached.meta, cached: true },
                    };
                }
                if (inFlight.has(key)) return inFlight.get(key);
            }

            const task = (async () => {
                let explanation;
                let source = 'fallback';
                let error = null;

                if (client) {
                    try {
                        explanation = await runOpenAIAgent(request, client);
                        source = 'openai';
                    } catch (err) {
                        error = safeString(err?.message, 'OpenAI request failed');
                        console.warn('Explanation agent failed, using local analysis:', error);
                    }
                }

                if (!explanation) explanation = createFallbackExplanation(request);

                const result = {
                    ...explanation,
                    meta: {
                        source,
                        model: source === 'openai' ? env.openaiModel : null,
                        cached: false,
                        generatedAt: new Date().toISOString(),
                        degraded: source !== 'openai',
                        error,
                    },
                };
                cache.set(key, result);
                return result;
            })();

            inFlight.set(key, task);
            try {
                return await task;
            } finally {
                inFlight.delete(key);
            }
        },
    };
}

const explanationService = createExplanationService();

module.exports = {
    AGENT_INSTRUCTIONS,
    AGENT_TOOLS,
    EXPLANATION_SCHEMA,
    createExplanationService,
    createFallbackExplanation,
    explanationService,
    normalizeRequest,
    runOpenAIAgent,
};
