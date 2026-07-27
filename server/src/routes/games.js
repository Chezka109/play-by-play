const express = require('express');

const { getMockPlays } = require('../services/mockData');

function toInt(value, fallback) {
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function gameRoutes({ gameWatcher, pollOnRead = false }) {
    const router = express.Router();

    router.post('/games/:eventId/watch', async (req, res, next) => {
        try {
            const { eventId } = req.params;
            if (!/^\d{6,20}$/.test(eventId)) {
                return res.status(400).json({ error: 'Invalid ESPN event ID' });
            }

            if (pollOnRead) {
                await gameWatcher.pollNow(eventId);
            } else {
                gameWatcher.watch(eventId);
            }
            const state = gameWatcher.getState(eventId);

            res.json({ ok: true, eventId, state: state.getPublicState() });
        } catch (err) {
            next(err);
        }
    });

    router.delete('/games/:eventId/watch', (req, res) => {
        const { eventId } = req.params;
        gameWatcher.unwatch(eventId);
        res.json({ ok: true, eventId });
    });

    router.get('/games/:eventId/state', async (req, res, next) => {
        try {
            const { eventId } = req.params;
            if (pollOnRead) await gameWatcher.pollNow(eventId);
            const state = gameWatcher.getState(eventId);
            if (!state) return res.status(404).json({ error: 'Game not watched' });
            res.json({ ok: true, eventId, state: state.getPublicState() });
        } catch (err) {
            next(err);
        }
    });

    router.get('/games/:eventId/latest', async (req, res, next) => {
        try {
            const { eventId } = req.params;
            if (pollOnRead) await gameWatcher.pollNow(eventId);
            const state = gameWatcher.getState(eventId);
            if (!state) return res.status(404).json({ error: 'Game not watched' });
            const latest = state.getLatestPlay();
            res.json({ ok: true, eventId, play: latest });
        } catch (err) {
            next(err);
        }
    });

    router.get('/games/:eventId/plays', async (req, res, next) => {
        try {
            const { eventId } = req.params;
            if (pollOnRead) await gameWatcher.pollNow(eventId);
            const state = gameWatcher.getState(eventId);
            if (!state) return res.status(404).json({ error: 'Game not watched' });

            const limit = Math.min(1000, Math.max(1, toInt(req.query.limit, 50)));
            const plays = state.getPlays({ limit });

            res.json({
                ok: true,
                eventId,
                plays,
                state: state.getPublicState(),
            });
        } catch (err) {
            next(err);
        }
    });

    router.get('/mock/plays', (req, res) => {
        res.json({ ok: true, plays: getMockPlays() });
    });

    return router;
}

module.exports = gameRoutes;
