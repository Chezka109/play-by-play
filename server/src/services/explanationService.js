const { env } = require('../config/env');
const { TtlCache } = require('./cache');

const cache = new TtlCache({ maxSize: 8000, ttlMs: 1000 * 60 * 60 * 24 * 30 });

function normalizeKey(text) {
    return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function fallbackExplain(text) {
    const t = String(text || '').trim();
    if (!t) return 'No play description available.';

    // Very small deterministic fallback (keeps dev usable without API key)
    if (/incomplete/i.test(t)) {
        return 'The quarterback throws a pass, but nobody catches it.';
    }
    if (/intercepted/i.test(t)) {
        return 'The quarterback throws a pass, but a defender catches it instead.';
    }
    if (/sacked/i.test(t)) {
        return 'The quarterback is tackled behind the line of scrimmage before they can throw.';
    }
    if (/touchdown/i.test(t)) {
        return 'The offense scores a touchdown on this play.';
    }
    if (/penalty|no play/i.test(t)) {
        return 'A penalty happens on the play, so the officials adjust the result.';
    }
    if (/rush|left end|right end|up the middle|scramble/i.test(t)) {
        return 'A player runs with the ball and tries to gain yards.';
    }
    if (/pass/i.test(t)) {
        return 'The quarterback throws a pass to a receiver to try to gain yards.';
    }
    return 'The offense runs a play to try to gain yards.';
}

async function callOpenAI({ text }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: env.openaiModel,
                temperature: 0.2,
                max_tokens: 80,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You explain American football plays to complete beginners. Use simple words and avoid jargon.',
                    },
                    {
                        role: 'user',
                        content:
                            `Explain this NFL play for a middle-school reader. Rules:\n` +
                            `- Maximum 2 sentences\n` +
                            `- No jargon (define roles like quarterback/receiver/defender)\n` +
                            `- Keep it simple and concrete\n\n` +
                            `Play text: "${text}"`,
                    },
                ],
            }),
            signal: controller.signal,
        });

        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            throw new Error(`OpenAI error ${resp.status}: ${body}`);
        }

        const json = await resp.json();
        const message = json?.choices?.[0]?.message?.content;
        return String(message || '').trim();
    } finally {
        clearTimeout(timeout);
    }
}

const explanationService = {
    async explain(text) {
        const key = normalizeKey(text);
        const cached = cache.get(key);
        if (cached) return { text: cached, cached: true, source: 'cache' };

        let explanation = '';

        if (env.openaiApiKey) {
            try {
                explanation = await callOpenAI({ text });
            } catch (err) {
                console.warn('OpenAI failed, using fallback:', err.message);
                explanation = fallbackExplain(text);
            }
        } else {
            explanation = fallbackExplain(text);
        }

        // Enforce max 2 sentences as a safety rail.
        const sentences = explanation
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        explanation = sentences.slice(0, 2).join(' ');

        cache.set(key, explanation);
        return { text: explanation, cached: false, source: env.openaiApiKey ? 'openai' : 'fallback' };
    },
};

module.exports = { explanationService };
