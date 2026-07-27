const { env } = require('../config/env');
const { fetchGameSummary, extractPlays, mapPlay } = require('./espnClient');
const { parsePlayText } = require('../parsers/playParser');
const { explanationService } = require('./explanationService');

class GameState {
    constructor(eventId) {
        this.eventId = eventId;
        this.playById = new Map();
        this.orderedIds = [];
        this.lastPollAt = null;
        this.lastError = null;
    }

    addPlay(play) {
        if (!play?.id) return false;
        if (this.playById.has(play.id)) return false;
        this.playById.set(play.id, play);
        this.orderedIds.push(play.id);
        return true;
    }

    getLatestPlay() {
        if (this.orderedIds.length === 0) return null;
        const id = this.orderedIds[this.orderedIds.length - 1];
        return this.playById.get(id) || null;
    }

    getPlays({ limit = 50 } = {}) {
        const ids = this.orderedIds.slice(-limit);
        return ids.map((id) => this.playById.get(id)).filter(Boolean);
    }

    getPublicState() {
        return {
            eventId: this.eventId,
            playCount: this.orderedIds.length,
            lastPollAt: this.lastPollAt,
            lastError: this.lastError,
            latestPlayId: this.getLatestPlay()?.id || null,
        };
    }
}

function createGameWatcher() {
    const states = new Map();
    const timers = new Map();
    const inFlight = new Set();

    async function poll(eventId) {
        if (inFlight.has(eventId)) return;
        inFlight.add(eventId);

        const state = states.get(eventId);
        try {
            const countBefore = state.orderedIds.length;
            const summary = await fetchGameSummary(eventId);
            const plays = extractPlays(summary);
            const newPlays = [];

            for (const raw of plays) {
                const base = mapPlay(raw);
                if (!base.id) continue;

                const parsed = parsePlayText(base.text);
                const play = {
                    ...base,
                    parsed,
                    explanation: null,
                    explanationMeta: null,
                };

                const added = state.addPlay(play);
                if (added) newPlays.push(play);
            }

            // Explain only newly-ingested plays, with caching.
            if (env.explainOnIngest && newPlays.length > 0) {
                const isBootstrap = countBefore === 0;
                const playsToExplain = isBootstrap ? newPlays.slice(-1) : newPlays;

                // Serial to be nice to rate limits.
                for (const play of playsToExplain) {
                    if (!play.text) continue;
                    const exp = await explanationService.explain(play.text);
                    play.explanation = exp.text;
                    play.explanationMeta = { source: exp.source, cached: exp.cached };
                }
            }

            state.lastPollAt = Date.now();
            state.lastError = null;
        } catch (err) {
            state.lastPollAt = Date.now();
            state.lastError = err?.message || String(err);
            console.warn(`Poll failed for ${eventId}:`, state.lastError);
        } finally {
            inFlight.delete(eventId);
        }
    }

    function ensureWatched(eventId, { pollIntervalMs } = {}) {
        if (!states.has(eventId)) {
            states.set(eventId, new GameState(eventId));
        }

        const effectivePollMs = pollIntervalMs ?? env.pollIntervalMs;

        if (!timers.has(eventId)) {
            // Kick once immediately
            poll(eventId);
            const timer = setInterval(() => poll(eventId), effectivePollMs);
            timers.set(eventId, timer);
        }

        return states.get(eventId);
    }

    return {
        async watch(eventId, { pollIntervalMs } = {}) {
            if (!eventId) throw new Error('eventId is required');
            return ensureWatched(eventId, { pollIntervalMs });
        },

        unwatch(eventId) {
            const timer = timers.get(eventId);
            if (timer) clearInterval(timer);
            timers.delete(eventId);
            states.delete(eventId);
            inFlight.delete(eventId);
        },

        getState(eventId) {
            return states.get(eventId) || null;
        },
    };
}

module.exports = { createGameWatcher };
