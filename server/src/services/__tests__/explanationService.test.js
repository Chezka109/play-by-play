const {
    createExplanationService,
    runOpenAIAgent,
} = require('../explanationService');

const play = {
    id: 'play-42',
    text: 'J. Allen sacked at BUF 18 for -7 yards',
    quarter: 2,
    clock: '8:42',
    down: 3,
    distance: 8,
    yardLine: 25,
    team: 'BUF',
};

describe('explanationService', () => {
    test('returns a complete deterministic analysis without an API key', async () => {
        const service = createExplanationService({ client: null });
        const explanation = await service.explain({ play, audience: 'rookie' });

        expect(explanation).toMatchObject({
            headline: 'Defense sacks the quarterback',
            confidence: 'high',
            meta: {
                source: 'fallback',
                degraded: true,
                cached: false,
            },
        });
        expect(explanation.summary).toContain('behind the starting line');
        expect(explanation.whyItMatters).toContain('3rd down');
        expect(explanation.concepts.map((concept) => concept.term)).toContain('sack');
        expect(explanation.text).toBe(explanation.summary);
    });

    test('runs the evidence tool before producing a structured model answer', async () => {
        const finalAnswer = {
            headline: 'Pressure creates a seven-yard loss',
            summary: 'A defender reached the quarterback before he could throw.',
            result: 'Buffalo lost seven yards.',
            whyItMatters: 'The loss makes the next down and distance harder.',
            strategy: 'The defense won before the pass could develop.',
            concepts: [
                {
                    term: 'sack',
                    definition:
                        'A tackle of the quarterback behind the line of scrimmage before a pass.',
                },
            ],
            watchFor: 'Watch the new ball spot and whether Buffalo must punt.',
            confidence: 'high',
        };
        const create = jest
            .fn()
            .mockResolvedValueOnce({
                output_text: '',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_inspect',
                        name: 'inspect_play',
                        arguments: '{"focus":"full"}',
                        status: 'completed',
                    },
                ],
            })
            .mockResolvedValueOnce({
                output_text: JSON.stringify(finalAnswer),
                output: [],
            });
        const client = { responses: { create } };

        const explanation = await runOpenAIAgent(
            {
                play,
                recentPlays: [],
                game: null,
                audience: 'rookie',
                safetyIdentifier: 'anonymous-test',
            },
            client
        );

        expect(explanation).toMatchObject(finalAnswer);
        expect(explanation.text).toBe(finalAnswer.summary);
        expect(create).toHaveBeenCalledTimes(2);

        const firstRequest = create.mock.calls[0][0];
        expect(firstRequest.model).toBe('gpt-5.6-sol');
        expect(firstRequest.tool_choice).toEqual({
            type: 'function',
            name: 'inspect_play',
        });
        expect(firstRequest.text).toMatchObject({
            verbosity: 'low',
            format: {
                type: 'json_schema',
                name: 'football_play_explanation',
                strict: true,
            },
        });
        expect(firstRequest.store).toBe(false);
        expect(firstRequest.safety_identifier).toBe('anonymous-test');

        const secondRequest = create.mock.calls[1][0];
        expect(secondRequest.input).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'function_call_output',
                    call_id: 'call_inspect',
                }),
            ])
        );
    });

    test('deduplicates and caches identical explanation work', async () => {
        const answer = {
            headline: 'Short run',
            summary: 'The runner gained three yards.',
            result: 'Three-yard gain.',
            whyItMatters: 'The offense is closer to a first down.',
            strategy: 'The run keeps the offense on schedule.',
            concepts: [],
            watchFor: 'Check the next down and distance.',
            confidence: 'high',
        };
        const create = jest
            .fn()
            .mockResolvedValueOnce({
                output: [
                    {
                        type: 'function_call',
                        call_id: 'inspect-cache',
                        name: 'inspect_play',
                        arguments: '{"focus":"full"}',
                        status: 'completed',
                    },
                ],
            })
            .mockResolvedValueOnce({ output: [], output_text: JSON.stringify(answer) });
        const service = createExplanationService({
            client: { responses: { create } },
        });
        const request = {
            play: { ...play, id: 'cache-test', text: 'Runner up the middle for 3 yards' },
        };

        const first = await service.explain(request);
        const second = await service.explain(request);

        expect(first.meta.source).toBe('openai');
        expect(second.meta.cached).toBe(true);
        expect(create).toHaveBeenCalledTimes(2);
    });
});
