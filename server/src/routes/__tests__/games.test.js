const mockRoutes = {};

jest.mock('express', () => ({
    Router: () => ({
        delete: (path, handler) => {
            mockRoutes[`DELETE ${path}`] = handler;
        },
        get: (path, handler) => {
            mockRoutes[`GET ${path}`] = handler;
        },
        post: (path, handler) => {
            mockRoutes[`POST ${path}`] = handler;
        },
    }),
}));

const gameRoutes = require('../games');

function createState(eventId) {
    return {
        getLatestPlay: () => ({ id: 'play-1', text: 'Runner up the middle for 4 yards' }),
        getPlays: () => [{ id: 'play-1', text: 'Runner up the middle for 4 yards' }],
        getPublicState: () => ({ eventId, playCount: 1, lastError: null }),
    };
}

describe('game routes in serverless mode', () => {
    test('refreshes a game before serving plays on a cold request', async () => {
        const states = new Map();
        const gameWatcher = {
            pollNow: jest.fn(async (eventId) => {
                states.set(eventId, createState(eventId));
            }),
            getState: jest.fn((eventId) => states.get(eventId) || null),
        };
        gameRoutes({ gameWatcher, pollOnRead: true });

        const req = {
            params: { eventId: '401772988' },
            query: { limit: '3' },
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };
        const next = jest.fn();

        await mockRoutes['GET /games/:eventId/plays'](req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(gameWatcher.pollNow).toHaveBeenCalledWith('401772988');
        expect(res.json).toHaveBeenCalledWith({
            ok: true,
            eventId: '401772988',
            plays: [{ id: 'play-1', text: 'Runner up the middle for 4 yards' }],
            state: { eventId: '401772988', playCount: 1, lastError: null },
        });
    });
});
