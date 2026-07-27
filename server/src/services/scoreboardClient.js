const axios = require('axios');
const { env } = require('../config/env');
const { TtlCache } = require('./cache');

const seasonCache = new TtlCache({
    maxSize: 12,
    ttlMs: env.scheduleCacheMs,
});
const archiveCache = new TtlCache({
    maxSize: 12,
    ttlMs: 1000 * 60 * 60 * 12,
});

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function safeGetCompetition(event) {
    return toArray(event?.competitions)[0] || null;
}

function mapCompetitor(competitor) {
    const team = competitor?.team || {};

    return {
        id: team.id ? String(team.id) : null,
        abbreviation: team.abbreviation ?? null,
        displayName: team.displayName ?? team.name ?? null,
        shortDisplayName: team.shortDisplayName ?? team.name ?? null,
        logo: toArray(team.logos)[0]?.href ?? team.logo ?? null,
        homeAway: competitor?.homeAway ?? null,
        score: competitor?.score ?? null,
        winner: Boolean(competitor?.winner),
    };
}

function mapEventToGame(event) {
    const competition = safeGetCompetition(event);
    const status = competition?.status || event?.status || {};
    const type = status?.type || {};
    const competitors = toArray(competition?.competitors).map(mapCompetitor);
    const homeTeam = competitors.find((team) => team.homeAway === 'home') || null;
    const awayTeam = competitors.find((team) => team.homeAway === 'away') || null;
    const broadcasts = toArray(competition?.broadcasts).flatMap((broadcast) =>
        toArray(broadcast?.names)
    );

    return {
        id: String(event?.id ?? ''),
        name: event?.name ?? competition?.name ?? null,
        shortName: event?.shortName ?? competition?.shortName ?? null,
        date: event?.date ?? competition?.date ?? null,
        seasonYear: event?.season?.year ?? null,
        seasonType: event?.season?.type ?? null,
        seasonSlug: event?.season?.slug ?? null,
        week: event?.week?.number ?? null,
        status: {
            state: type?.state ?? null,
            name: type?.name ?? null,
            detail: type?.detail ?? type?.shortDetail ?? null,
            shortDetail: type?.shortDetail ?? type?.detail ?? null,
            completed: Boolean(type?.completed),
            clock: status?.displayClock ?? null,
            period: status?.period ?? null,
        },
        teams: {
            home: homeTeam,
            away: awayTeam,
        },
        broadcasts: [...new Set(broadcasts.filter(Boolean))],
        venue: competition?.venue
            ? {
                  name: competition.venue.fullName ?? null,
                  city: competition.venue.address?.city ?? null,
                  state: competition.venue.address?.state ?? null,
                  country: competition.venue.address?.country ?? null,
                  indoor: competition.venue.indoor ?? null,
              }
            : null,
    };
}

function uniqueById(games) {
    const byId = new Map();
    for (const game of games) {
        if (game?.id) byId.set(game.id, game);
    }
    return [...byId.values()];
}

function sortByDateAscending(games) {
    return games.sort((a, b) => {
        const aDate = a.date ? Date.parse(a.date) : Number.MAX_SAFE_INTEGER;
        const bDate = b.date ? Date.parse(b.date) : Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
        return String(a.id).localeCompare(String(b.id));
    });
}

async function fetchScoreboard({ date, seasonYear, week, seasonType, limit = 100 } = {}) {
    const params = { limit: String(limit) };

    if (date) params.dates = String(date);
    if (seasonYear) params.dates = String(seasonYear);
    if (week) params.week = String(week);
    if (seasonType) params.seasontype = String(seasonType);

    const resp = await axios.get(env.espnScoreboardBaseUrl, {
        params,
        headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'play-by-play/1.0',
        },
        timeout: env.providerTimeoutMs,
    });

    return resp.data;
}

function extractGames(scoreboardJson) {
    const games = toArray(scoreboardJson?.events)
        .map(mapEventToGame)
        .filter((game) => game.id);
    return sortByDateAscending(games);
}

/**
 * ESPN's scoreboard uses `dates`, not `year`, to select a calendar year.
 * An NFL season crosses New Year's Day, so both calendar years are fetched
 * and the event's own season.year is used as the source of truth.
 */
async function fetchSeasonGames({ year, force = false } = {}) {
    const seasonYear = Number(year);
    if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
        throw new Error(`Invalid season year: ${year}`);
    }

    const cacheKey = `season:${seasonYear}`;
    if (!force) {
        const targetCache =
            seasonYear < getCurrentNflSeasonYear() ? archiveCache : seasonCache;
        const cached = targetCache.get(cacheKey);
        if (cached) return cached;
    }

    const [startYear, endYear] = await Promise.all([
        fetchScoreboard({ seasonYear, limit: 1000 }),
        fetchScoreboard({ seasonYear: seasonYear + 1, limit: 1000 }),
    ]);

    const games = uniqueById([
        ...extractGames(startYear),
        ...extractGames(endYear),
    ]).filter((game) => Number(game.seasonYear) === seasonYear);

    sortByDateAscending(games);

    const result = {
        seasonYear,
        games,
        fetchedAt: new Date().toISOString(),
        provider: 'espn',
    };
    const targetCache =
        seasonYear < getCurrentNflSeasonYear() ? archiveCache : seasonCache;
    targetCache.set(cacheKey, result);
    return result;
}

function getCurrentNflSeasonYear(now = new Date()) {
    const month = now.getUTCMonth();
    return month <= 1 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

function getLastCompletedSeasonYear(now = new Date()) {
    return getCurrentNflSeasonYear(now) - 1;
}

function splitGamesByStatus(games, now = new Date()) {
    const nowMs = now.getTime();
    const live = [];
    const upcoming = [];
    const previous = [];

    for (const game of games) {
        const state = game.status?.state;
        const dateMs = game.date ? Date.parse(game.date) : Number.NaN;

        if (state === 'in') {
            live.push(game);
        } else if (
            state === 'pre' &&
            (!Number.isFinite(dateMs) || dateMs >= nowMs - 1000 * 60 * 60 * 8)
        ) {
            upcoming.push(game);
        } else if (state === 'post' || game.status?.completed) {
            previous.push(game);
        }
    }

    sortByDateAscending(live);
    sortByDateAscending(upcoming);
    previous.sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));

    return { live, upcoming, previous };
}

module.exports = {
    extractGames,
    fetchScoreboard,
    fetchSeasonGames,
    getCurrentNflSeasonYear,
    getLastCompletedSeasonYear,
    mapEventToGame,
    splitGamesByStatus,
};
