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

const env = {
    port: requireNumber(process.env.PORT, { name: 'PORT', fallback: 3001 }),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    defaultEventId: process.env.DEFAULT_EVENT_ID || '',
    pollIntervalMs: requireNumber(process.env.POLL_INTERVAL_MS, {
        name: 'POLL_INTERVAL_MS',
        fallback: 8000,
    }),
    espnSummaryBaseUrl:
        process.env.ESPN_SUMMARY_BASE_URL ||
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    explainOnIngest: requireBoolean(process.env.EXPLAIN_ON_INGEST, {
        fallback: true,
    }),
};

module.exports = { env };
