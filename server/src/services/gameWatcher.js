const { env } = require('../config/env');
const {
    fetchGameSummary,
    extractPlays,
    mapGameContext,
    mapPlay,
} = require('./espnClient');
const { parsePlayText } = require('../parsers/playParser');
const { explanationService } = require('./explanationService');

class GameState {
    constructor(eventId) {
        this.eventId = eventId;
        this.playById = new Map();
        this.orderedIds = [];
        this.game = null;
        this.lastPollAt = null;
        this.nextPollAt = null;
        this.lastError = null;
        this.consecutiveErrors = 0;
    }

    upsertPlay(play) {
        if (!play?.id) return { added: false, changed: false, play: null };

        const existing = this.playById.get(play.id);
        if (!existing) {
            this.playById.set(play.id, play);
            this.orderedIds.push(play.id);
            return { added: true, changed: true, play };
        }

        const sameText = existing.text === play.text;
        const updated = {
            ...existing,
            ...play,
            explanation: sameText ? existing.explanation : null,
            explanationMeta: sameText ? existing.explanationMeta : null,
        };
        const changed =
            existing.text !== updated.text ||
            existing.clock !== updated.clock ||
            existing.down !== updated.down ||
            existing.distance !== updated.distance ||
            existing.yardLine !== updated.yardLine;

        this.playById.set(play.id, updated);
        return { added: false, changed, play: updated };
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
            nextPollAt: this.nextPollAt,
            lastError: this.lastError,
            latestPlayId: this.getLatestPlay()?.id || null,
            game: this.game,
        };
    }
}

function calculateNextPollDelay(game, now = Date.now()) {
    const state = game?.status?.state;
    if (state === 'post' || game?.status?.completed) return null;
    if (state === 'in') return env.pollIntervalMs;

    if (state === 'pre' && game?.date) {
        const untilKickoff = Date.parse(game.date) - now;
        if (untilKickoff > 1000 * 60 * 60 * 6) return 1000 * 60 * 15;
        if (untilKickoff > 1000 * 60 * 60) return 1000 * 60 * 5;
        if (untilKickoff > 1000 * 60 * 10) return 1000 * 30;
        return Math.max(env.pollIntervalMs, 10000);
    }

    return Math.max(env.pollIntervalMs, 15000);
}

function createGameWatcher({
    fetchSummary = fetchGameSummary,
    explain = (request) => explanationService.explain(request),
    now = () => Date.now(),
} = {}) {
    const states = new Map();
    const timers = new Map();
    const inFlight = new Set();
    const explanationsInFlight = new Set();

    function clearTimer(eventId) {
        const timer = timers.get(eventId);
        if (timer) clearTimeout(timer);
        timers.delete(eventId);
    }

    function schedule(eventId, delayMs) {
        clearTimer(eventId);
        const state = states.get(eventId);
        if (!state || delayMs == null) {
            if (state) state.nextPollAt = null;
            return;
        }

        state.nextPollAt = now() + delayMs;
        const timer = setTimeout(() => {
            timers.delete(eventId);
            void poll(eventId);
        }, delayMs);
        timer.unref?.();
        timers.set(eventId, timer);
    }

    async function explainNewPlays(state, newPlays, countBefore) {
        if (!env.explainOnIngest || newPlays.length === 0) return;
        const playsToExplain = countBefore === 0 ? newPlays.slice(-1) : newPlays;

        for (const play of playsToExplain) {
            if (!play.text || explanationsInFlight.has(play.id)) continue;
            explanationsInFlight.add(play.id);
            try {
                const recentPlays = state
                    .getPlays({ limit: 6 })
                    .filter((item) => item.id !== play.id);
                const explanation = await explain({
                    play,
                    recentPlays,
                    game: state.game,
                });
                const current = state.playById.get(play.id);
                if (current && current.text === play.text) {
                    current.explanation = explanation;
                    current.explanationMeta = explanation.meta;
                }
            } catch (err) {
                console.warn(`Explanation failed for play ${play.id}:`, err?.message || err);
            } finally {
                explanationsInFlight.delete(play.id);
            }
        }
    }

    async function poll(eventId) {
        if (inFlight.has(eventId) || !states.has(eventId)) return;
        inFlight.add(eventId);

        const state = states.get(eventId);
        try {
            const countBefore = state.orderedIds.length;
            const summary = await fetchSummary(eventId);
            const plays = extractPlays(summary);
            const newPlays = [];

            state.game = mapGameContext(summary);

            for (const raw of plays) {
                const base = mapPlay(raw);
                if (!base.id) continue;

                const result = state.upsertPlay({
                    ...base,
                    parsed: parsePlayText(base.text),
                    explanation: null,
                    explanationMeta: null,
                });
                if (result.added) newPlays.push(result.play);
            }

            state.lastPollAt = now();
            state.lastError = null;
            state.consecutiveErrors = 0;

            // Explanation work must never delay the next live-data poll.
            void explainNewPlays(state, newPlays, countBefore);
            schedule(eventId, calculateNextPollDelay(state.game, now()));
        } catch (err) {
            state.lastPollAt = now();
            state.lastError = err?.message || String(err);
            state.consecutiveErrors += 1;
            const retryMs = Math.min(
                1000 * 60,
                Math.max(env.pollIntervalMs, 5000) * 2 ** Math.min(state.consecutiveErrors, 4)
            );
            schedule(eventId, retryMs);
            console.warn(`Poll failed for ${eventId}:`, state.lastError);
        } finally {
            inFlight.delete(eventId);
        }
    }

    function ensureWatched(eventId) {
        if (!states.has(eventId)) states.set(eventId, new GameState(eventId));
        if (!timers.has(eventId) && !inFlight.has(eventId)) void poll(eventId);
        return states.get(eventId);
    }

    return {
        watch(eventId) {
            if (!eventId) throw new Error('eventId is required');
            return ensureWatched(eventId);
        },

        unwatch(eventId) {
            clearTimer(eventId);
            states.delete(eventId);
            inFlight.delete(eventId);
        },

        getState(eventId) {
            return states.get(eventId) || null;
        },

        pollNow(eventId) {
            if (!states.has(eventId)) states.set(eventId, new GameState(eventId));
            return poll(eventId);
        },

        getDiagnostics() {
            return {
                watchedGames: states.size,
                activePolls: inFlight.size,
                scheduledPolls: timers.size,
                explanationsInFlight: explanationsInFlight.size,
            };
        },

        stopAll() {
            for (const eventId of timers.keys()) clearTimer(eventId);
            states.clear();
            inFlight.clear();
            explanationsInFlight.clear();
        },
    };
}

module.exports = { GameState, calculateNextPollDelay, createGameWatcher };
