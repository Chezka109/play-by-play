const dotenv = require('dotenv');

dotenv.config();

function requireNumber(value, { name, fallback }) {
    if (value == null || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid number for ${name}: ${value}`);
    }
    return n;
}

function requireBoolean(value, { fallback }) {
    if (value == null || value === '') return fallback;
    const v = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(v)) return true;
    if (['false', '0', 'no', 'n'].includes(v)) return false;
    return fallback;
}

function requireEnum(value, { name, allowed, fallback }) {
    const normalized = String(value || fallback).trim().toLowerCase();
    if (!allowed.includes(normalized)) {
        throw new Error(`Invalid value for ${name}: ${value}`);
    }
    return normalized;
}

const env = {
    port: requireNumber(process.env.PORT, { name: 'PORT', fallback: 3001 }),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    defaultEventId: process.env.DEFAULT_EVENT_ID || '',
    pollIntervalMs: requireNumber(process.env.POLL_INTERVAL_MS, {
        name: 'POLL_INTERVAL_MS',
        fallback: 5000,
    }),
    espnSummaryBaseUrl:
        process.env.ESPN_SUMMARY_BASE_URL ||
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=',
    espnScoreboardBaseUrl:
        process.env.ESPN_SCOREBOARD_BASE_URL ||
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    providerTimeoutMs: requireNumber(process.env.PROVIDER_TIMEOUT_MS, {
        name: 'PROVIDER_TIMEOUT_MS',
        fallback: 8000,
    }),
    scheduleCacheMs: requireNumber(process.env.SCHEDULE_CACHE_MS, {
        name: 'SCHEDULE_CACHE_MS',
        fallback: 20000,
    }),
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
    openaiReasoningEffort: requireEnum(process.env.OPENAI_REASONING_EFFORT, {
        name: 'OPENAI_REASONING_EFFORT',
        allowed: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
        fallback: 'low',
    }),
    openaiTimeoutMs: requireNumber(process.env.OPENAI_TIMEOUT_MS, {
        name: 'OPENAI_TIMEOUT_MS',
        fallback: 15000,
    }),
    openaiMaxOutputTokens: requireNumber(process.env.OPENAI_MAX_OUTPUT_TOKENS, {
        name: 'OPENAI_MAX_OUTPUT_TOKENS',
        fallback: 1200,
    }),
    openaiMaxToolRounds: requireNumber(process.env.OPENAI_MAX_TOOL_ROUNDS, {
        name: 'OPENAI_MAX_TOOL_ROUNDS',
        fallback: 2,
    }),
    explainOnIngest: requireBoolean(process.env.EXPLAIN_ON_INGEST, {
        fallback: true,
    }),
    explainRateLimitMax: requireNumber(process.env.EXPLAIN_RATE_LIMIT_MAX, {
        name: 'EXPLAIN_RATE_LIMIT_MAX',
        fallback: 30,
    }),
    explainRateLimitWindowMs: requireNumber(
        process.env.EXPLAIN_RATE_LIMIT_WINDOW_MS,
        {
            name: 'EXPLAIN_RATE_LIMIT_WINDOW_MS',
            fallback: 60000,
        }
    ),
    trustProxy: requireBoolean(process.env.TRUST_PROXY, { fallback: false }),
};

module.exports = { env };
