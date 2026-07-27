const axios = require('axios');
const { TtlCache } = require('./cache');

const SCOREBOARD_URL =
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

const seasonCache = new TtlCache({ maxSize: 50, ttlMs: 1000 * 60 * 60 * 12 });

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function safeGetCompetition(event) {
    const comps = toArray(event?.competitions);
    return comps[0] || null;
}

function mapEventToGame(event) {
    const competition = safeGetCompetition(event);
    const status = competition?.status || event?.status || {};
    const type = status?.type || {};

    const state = type?.state || null; // 'pre' | 'in' | 'post'
    const detail = type?.detail || null;
    const completed = Boolean(type?.completed);

    return {
        id: String(event?.id ?? ''),
        name: event?.name ?? competition?.name ?? null,
        shortName: event?.shortName ?? competition?.shortName ?? null,
        date: event?.date ?? competition?.date ?? null,
        status: {
            state,
            detail,
            completed,
        },
    };
}

function uniqueById(games) {
    const seen = new Set();
    const out = [];
    for (const g of games) {
        if (!g?.id) continue;
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        out.push(g);
    }
    return out;
}

async function fetchScoreboard({ date, year, week, seasonType } = {}) {
    const params = {};
    if (date) params.dates = String(date);
    if (year) params.year = String(year);
    if (week) params.week = String(week);
    if (seasonType) params.seasontype = String(seasonType);

    const resp = await axios.get(SCOREBOARD_URL, {
        params,
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'play-by-play/0.1',
        },
        timeout: 8000,
    });

    return resp.data;
}

function getLastCompletedSeasonYear(now = new Date()) {
    // Simple rule: "last completed season" is the prior calendar year.
    // Example: Apr 2026 -> 2025 season (ended Feb 2026).
    return now.getFullYear() - 1;
}

async function fetchSeasonGames({ year } = {}) {
    const seasonYear = Number(year);
    if (!Number.isFinite(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
        throw new Error(`Invalid season year: ${year}`);
    }

    const cacheKey = `season:${seasonYear}`;
    const cached = seasonCache.get(cacheKey);
    if (cached) return cached;

    const all = [];

    // Regular season (18 weeks)
    for (let week = 1; week <= 18; week++) {
        const json = await fetchScoreboard({ year: seasonYear, week, seasonType: 2 });
        const games = extractGames(json);
        all.push(...games);
        if (week >= 18) break;
    }

    // Postseason (weeks vary; stop when we hit an empty week after we've found some)
    let foundAnyPost = false;
    for (let week = 1; week <= 6; week++) {
        const json = await fetchScoreboard({ year: seasonYear, week, seasonType: 3 });
        const games = extractGames(json);
        if (games.length > 0) {
            foundAnyPost = true;
            all.push(...games);
        } else if (foundAnyPost) {
            break;
        }
    }

    const games = uniqueById(all);

    // Sort newest first for dropdown usability
    games.sort((a, b) => {
        const ad = a.date ? Date.parse(a.date) : 0;
        const bd = b.date ? Date.parse(b.date) : 0;
        if (ad !== bd) return bd - ad;
        return String(b.id).localeCompare(String(a.id));
    });

    const result = { seasonYear, games };
    seasonCache.set(cacheKey, result);
    return result;
}

function extractGames(scoreboardJson) {
    const events = toArray(scoreboardJson?.events);
    const games = events.map(mapEventToGame).filter((g) => g.id);

    // Prefer stable ordering by date, then id.
    games.sort((a, b) => {
        const ad = a.date ? Date.parse(a.date) : 0;
        const bd = b.date ? Date.parse(b.date) : 0;
        if (ad !== bd) return ad - bd;
        return String(a.id).localeCompare(String(b.id));
    });

    return games;
}

function formatYyyyMmDd(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

async function fetchGamesWindow({ daysBack = 7 } = {}) {
    const n = Math.max(0, Math.min(7, Number(daysBack) || 0));

    const all = [];
    const today = new Date();

    // ESPN sometimes returns no events for explicit dates (especially off-season),
    // but the undated scoreboard can still include a "featured" event.
    try {
        const json = await fetchScoreboard();
        all.push(...extractGames(json));
    } catch {
        // ignore; date-window fetches may still succeed
    }

    for (let i = 0; i <= n; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const date = formatYyyyMmDd(d);
        const json = await fetchScoreboard({ date });
        all.push(...extractGames(json));
    }

    const games = uniqueById(all);

    const live = games.filter((g) => g.status?.state === 'in' || g.status?.state === 'pre');
    const previous = games.filter((g) => g.status?.state === 'post' || g.status?.completed);

    return {
        live,
        previous,
        all: games,
    };
}

module.exports = {
    fetchScoreboard,
    extractGames,
    fetchGamesWindow,
    fetchSeasonGames,
    getLastCompletedSeasonYear,
};
