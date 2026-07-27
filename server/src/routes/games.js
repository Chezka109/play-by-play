const express = require('express');

const { getMockPlays } = require('../services/mockData');

function toInt(value, fallback) {
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function gameRoutes({ gameWatcher }) {
    const router = express.Router();

    router.post('/games/:eventId/watch', async (req, res, next) => {
        try {
            const { eventId } = req.params;
            const pollIntervalMs = toInt(req.body?.pollIntervalMs, undefined);

            const state = await gameWatcher.watch(eventId, {
                pollIntervalMs,
            });

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

    router.get('/games/:eventId/state', (req, res) => {
        const { eventId } = req.params;
        const state = gameWatcher.getState(eventId);
        if (!state) return res.status(404).json({ error: 'Game not watched' });
        res.json({ ok: true, eventId, state: state.getPublicState() });
    });

    router.get('/games/:eventId/latest', (req, res) => {
        const { eventId } = req.params;
        const state = gameWatcher.getState(eventId);
        if (!state) return res.status(404).json({ error: 'Game not watched' });
        const latest = state.getLatestPlay();
        res.json({ ok: true, eventId, play: latest });
    });

    router.get('/games/:eventId/plays', (req, res) => {
        const { eventId } = req.params;
        const state = gameWatcher.getState(eventId);
        if (!state) return res.status(404).json({ error: 'Game not watched' });

        const limit = Math.min(1000, Math.max(1, toInt(req.query.limit, 50)));
        const plays = state.getPlays({ limit });

        res.json({ ok: true, eventId, plays });
    });

    router.get('/mock/plays', (req, res) => {
        res.json({ ok: true, plays: getMockPlays() });
    });

    return router;
}

module.exports = gameRoutes;
