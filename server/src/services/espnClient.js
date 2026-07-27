const axios = require('axios');
const { env } = require('../config/env');

async function fetchGameSummary(eventId) {
    const url = `${env.espnSummaryBaseUrl}${encodeURIComponent(eventId)}`;
    const resp = await axios.get(url, {
        headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'play-by-play/1.0',
        },
        timeout: env.providerTimeoutMs,
    });
    return resp.data;
}

function mapGameContext(summaryJson) {
    const header = summaryJson?.header || {};
    const competition = toArray(header?.competitions)[0] || {};
    const status = competition?.status || {};
    const statusType = status?.type || {};
    const competitors = toArray(competition?.competitors).map((competitor) => ({
        id: competitor?.team?.id ? String(competitor.team.id) : null,
        abbreviation: competitor?.team?.abbreviation ?? null,
        displayName: competitor?.team?.displayName ?? competitor?.team?.name ?? null,
        logo: competitor?.team?.logos?.[0]?.href ?? competitor?.team?.logo ?? null,
        homeAway: competitor?.homeAway ?? null,
        score: competitor?.score ?? null,
    }));

    return {
        id: String(header?.id ?? competition?.id ?? ''),
        name: competition?.description ?? header?.gameNote ?? null,
        shortName: competition?.shortName ?? null,
        date: competition?.date ?? null,
        seasonYear: header?.season?.year ?? null,
        seasonType: header?.season?.type ?? null,
        week: header?.week ?? null,
        status: {
            state: statusType?.state ?? null,
            name: statusType?.name ?? null,
            detail: statusType?.detail ?? statusType?.shortDetail ?? null,
            shortDetail: statusType?.shortDetail ?? statusType?.detail ?? null,
            completed: Boolean(statusType?.completed),
            clock: status?.displayClock ?? null,
            period: status?.period ?? null,
        },
        teams: {
            home: competitors.find((team) => team.homeAway === 'home') || null,
            away: competitors.find((team) => team.homeAway === 'away') || null,
        },
    };
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

module.exports = { fetchGameSummary, extractPlays, mapGameContext, mapPlay };
