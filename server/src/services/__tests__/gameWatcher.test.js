const {
    GameState,
    calculateNextPollDelay,
    createGameWatcher,
} = require('../gameWatcher');

function summary({ state = 'pre', completed = false, date = '2026-09-10T00:20:00Z' } = {}) {
    return {
        header: {
            id: '401872656',
            season: { year: 2026, type: 2 },
            week: 1,
            competitions: [
                {
                    id: '401872656',
                    date,
                    status: {
                        type: {
                            state,
                            completed,
                            name: state === 'pre' ? 'STATUS_SCHEDULED' : 'STATUS_FINAL',
                            detail: state === 'pre' ? 'Scheduled' : 'Final',
                        },
                    },
                    competitors: [
                        {
                            homeAway: 'home',
                            score: '0',
                            team: { id: '1', abbreviation: 'SEA', displayName: 'Seattle' },
                        },
                        {
                            homeAway: 'away',
                            score: '0',
                            team: {
                                id: '2',
                                abbreviation: 'NE',
                                displayName: 'New England',
                            },
                        },
                    ],
                },
            ],
        },
    };
}

describe('GameState', () => {
    test('updates provider corrections and preserves valid explanations', () => {
        const state = new GameState('game-1');
        state.upsertPlay({
            id: 'play-1',
            text: 'Runner for 4 yards',
            clock: '10:00',
            explanation: { summary: 'Four-yard run' },
        });

        const sameText = state.upsertPlay({
            id: 'play-1',
            text: 'Runner for 4 yards',
            clock: '9:59',
            explanation: null,
        });
        expect(sameText.changed).toBe(true);
        expect(state.getLatestPlay().explanation).toEqual({ summary: 'Four-yard run' });

        state.upsertPlay({
            id: 'play-1',
            text: 'Runner for 5 yards',
            clock: '9:59',
            explanation: null,
        });
        expect(state.getLatestPlay().explanation).toBeNull();
        expect(state.orderedIds).toEqual(['play-1']);
    });
});

describe('calculateNextPollDelay', () => {
    const now = Date.parse('2026-07-27T12:00:00Z');

    test('polls live games quickly and stops completed games', () => {
        expect(calculateNextPollDelay({ status: { state: 'in' } }, now)).toBe(5000);
        expect(
            calculateNextPollDelay({ status: { state: 'post', completed: true } }, now)
        ).toBeNull();
    });

    test('backs off for games that are far from kickoff', () => {
        expect(
            calculateNextPollDelay(
                {
                    date: '2026-09-10T00:20:00Z',
                    status: { state: 'pre', completed: false },
                },
                now
            )
        ).toBe(15 * 60 * 1000);
    });
});

describe('createGameWatcher', () => {
    test('maps pregame context and schedules an adaptive refresh', async () => {
        const watcher = createGameWatcher({
            fetchSummary: jest.fn().mockResolvedValue(summary()),
            explain: jest.fn(),
            now: () => Date.parse('2026-07-27T12:00:00Z'),
        });

        await watcher.pollNow('401872656');
        const state = watcher.getState('401872656');

        expect(state.getPublicState()).toMatchObject({
            eventId: '401872656',
            playCount: 0,
            game: {
                seasonYear: 2026,
                week: 1,
                status: { state: 'pre', completed: false },
                teams: {
                    home: { abbreviation: 'SEA' },
                    away: { abbreviation: 'NE' },
                },
            },
        });
        expect(watcher.getDiagnostics().scheduledPolls).toBe(1);
        watcher.stopAll();
    });
});
