const express = require('express');

const {
    fetchSeasonGames,
    getCurrentNflSeasonYear,
    splitGamesByStatus,
} = require('../services/scoreboardClient');

function toInt(value, fallback) {
    if (value == null || value === '') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

const router = express.Router();

router.get('/nfl/games', async (req, res, next) => {
    try {
        const seasonYear = toInt(req.query.seasonYear, getCurrentNflSeasonYear());
        const upcomingLimit = Math.min(100, Math.max(1, toInt(req.query.upcomingLimit, 40)));
        const previousLimit = Math.min(200, Math.max(1, toInt(req.query.previousLimit, 80)));

        const season = await fetchSeasonGames({ year: seasonYear });
        const groups = splitGamesByStatus(season.games);

        let previous = groups.previous;
        let historySeasonYear = seasonYear;

        // Before the first game of a new season, keep the picker useful by
        // showing the most recently completed season as history.
        if (previous.length === 0) {
            const history = await fetchSeasonGames({ year: seasonYear - 1 });
            previous = splitGamesByStatus(history.games).previous;
            historySeasonYear = history.seasonYear;
        }

        const upcoming = groups.upcoming.slice(0, upcomingLimit);
        const recent = previous.slice(0, previousLimit);

        res.json({
            ok: true,
            live: groups.live,
            upcoming,
            previous: recent,
            all: [...groups.live, ...upcoming, ...recent],
            meta: {
                provider: season.provider,
                seasonYear,
                historySeasonYear,
                fetchedAt: season.fetchedAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
