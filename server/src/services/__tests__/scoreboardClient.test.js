const {
    extractGames,
    getCurrentNflSeasonYear,
    mapEventToGame,
    splitGamesByStatus,
} = require('../scoreboardClient');

function event({
    id,
    date,
    state = 'pre',
    completed = false,
    seasonYear = 2026,
    seasonType = 2,
    week = 1,
} = {}) {
    return {
        id,
        name: 'Away Team at Home Team',
        shortName: 'AWY @ HOM',
        date,
        season: { year: seasonYear, type: seasonType, slug: 'regular-season' },
        week: { number: week },
        status: {
            displayClock: state === 'in' ? '8:42' : '0:00',
            period: state === 'in' ? 2 : 0,
            type: {
                state,
                completed,
                name: state === 'pre' ? 'STATUS_SCHEDULED' : 'STATUS_FINAL',
                detail: state === 'pre' ? 'Sun, September 13th' : 'Final',
            },
        },
        competitions: [
            {
                competitors: [
                    {
                        homeAway: 'home',
                        score: '24',
                        team: {
                            id: '1',
                            abbreviation: 'HOM',
                            displayName: 'Home Team',
                            logos: [{ href: 'https://example.com/home.png' }],
                        },
                    },
                    {
                        homeAway: 'away',
                        score: '17',
                        team: {
                            id: '2',
                            abbreviation: 'AWY',
                            displayName: 'Away Team',
                        },
                    },
                ],
                broadcasts: [{ names: ['ESPN', 'ABC'] }],
                venue: {
                    fullName: 'Example Stadium',
                    address: { city: 'New York', state: 'NY', country: 'USA' },
                    indoor: false,
                },
            },
        ],
    };
}

describe('scoreboardClient', () => {
    test('maps the event fields used by the live game picker', () => {
        const game = mapEventToGame(
            event({ id: '401872656', date: '2026-09-10T00:20:00Z' })
        );

        expect(game).toMatchObject({
            id: '401872656',
            seasonYear: 2026,
            seasonType: 2,
            week: 1,
            status: { state: 'pre', completed: false },
            teams: {
                home: { abbreviation: 'HOM', score: '24' },
                away: { abbreviation: 'AWY', score: '17' },
            },
            broadcasts: ['ESPN', 'ABC'],
            venue: { name: 'Example Stadium', city: 'New York' },
        });
    });

    test('sorts extracted events by kickoff time', () => {
        const games = extractGames({
            events: [
                event({ id: 'later', date: '2026-09-11T00:00:00Z' }),
                event({ id: 'earlier', date: '2026-09-10T00:00:00Z' }),
            ],
        });

        expect(games.map((game) => game.id)).toEqual(['earlier', 'later']);
    });

    test('splits live, upcoming, and completed games without treating scheduled as live', () => {
        const games = [
            mapEventToGame(
                event({
                    id: 'live',
                    date: '2026-09-10T00:00:00Z',
                    state: 'in',
                })
            ),
            mapEventToGame(
                event({
                    id: 'upcoming',
                    date: '2026-09-11T00:00:00Z',
                    state: 'pre',
                })
            ),
            mapEventToGame(
                event({
                    id: 'final',
                    date: '2026-09-09T00:00:00Z',
                    state: 'post',
                    completed: true,
                })
            ),
        ];

        const result = splitGamesByStatus(games, new Date('2026-09-10T12:00:00Z'));
        expect(result.live.map((game) => game.id)).toEqual(['live']);
        expect(result.upcoming.map((game) => game.id)).toEqual(['upcoming']);
        expect(result.previous.map((game) => game.id)).toEqual(['final']);
    });

    test('uses the prior season during January and February', () => {
        expect(getCurrentNflSeasonYear(new Date('2027-01-15T00:00:00Z'))).toBe(2026);
        expect(getCurrentNflSeasonYear(new Date('2026-07-27T00:00:00Z'))).toBe(2026);
    });
});
