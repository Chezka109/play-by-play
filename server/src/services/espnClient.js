const axios = require('axios');
const { env } = require('../config/env');

async function fetchGameSummary(eventId) {
    const url = `${env.espnSummaryBaseUrl}${encodeURIComponent(eventId)}`;
    const resp = await axios.get(url, {
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'play-by-play/0.1',
        },
        timeout: 8000,
    });
    return resp.data;
}

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function extractPlays(summaryJson) {
    const drives = summaryJson?.drives || {};
    const previous = toArray(drives.previous);
    const current = toArray(drives.current);

    const drivesAll = [...previous, ...current].filter(Boolean);

    const plays = [];
    for (const drive of drivesAll) {
        const drivePlays = Array.isArray(drive?.plays) ? drive.plays : [];
        for (const p of drivePlays) {
            plays.push(p);
        }
    }

    // Sort by numeric id if possible; ESPN usually uses increasing ids.
    plays.sort((a, b) => {
        const ai = Number(a?.id);
        const bi = Number(b?.id);
        if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });

    return plays;
}

function mapPlay(p) {
    const start = p?.start || {};
    const period = p?.period || {};
    const clock = p?.clock || {};
    const type = p?.type || {};

    return {
        id: String(p?.id ?? ''),
        text: p?.text ?? '',
        quarter: period?.number ?? null,
        clock: clock?.displayValue ?? null,
        down: start?.down ?? null,
        distance: start?.distance ?? null,
        yardLine: start?.yardLine ?? null,
        possessionText: start?.possessionText ?? null,
        team: start?.team?.abbreviation ?? null,
        typeText: type?.text ?? null,
    };
}

module.exports = { fetchGameSummary, extractPlays, mapPlay };
