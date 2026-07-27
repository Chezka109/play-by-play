const express = require('express');

const {
    fetchGamesWindow,
    fetchSeasonGames,
    getLastCompletedSeasonYear,
} = require('../services/scoreboardClient');

function toInt(value, fallback) {
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
    if (value == null) return fallback;
    const v = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(v)) return true;
    if (['0', 'false', 'no', 'n'].includes(v)) return false;
    return fallback;
}

const router = express.Router();

// Returns games from ESPN scoreboard, split into live/upcoming and previous/final.
// Query:
// - daysBack: number (0-7). Default: 7.
// - previousSeason: boolean. If true, "previous" list becomes the full last-completed season.
// - seasonYear: number. Optional override when previousSeason=true.
router.get('/nfl/games', async (req, res, next) => {
    try {
        const daysBack = toInt(req.query.daysBack, 7);
        const previousSeason = toBool(req.query.previousSeason, false);

        // Live list: use a short date window / undated fallback
        const window = await fetchGamesWindow({ daysBack });

        if (!previousSeason) {
            return res.json({ ok: true, ...window, meta: { mode: 'window', daysBack } });
        }

        const seasonYear = toInt(req.query.seasonYear, getLastCompletedSeasonYear());
        const season = await fetchSeasonGames({ year: seasonYear });

        return res.json({
            ok: true,
            live: window.live,
            previous: season.games,
            all: [...window.live, ...season.games],
            meta: { mode: 'previousSeason', seasonYear: season.seasonYear },
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
