const { createRateLimiter } = require('../rateLimit');

function makeResponse() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

describe('createRateLimiter', () => {
    test('allows requests through the limit and returns 429 after it', () => {
        let timestamp = 1000;
        const limiter = createRateLimiter({
            windowMs: 60000,
            max: 2,
            now: () => timestamp,
        });
        const request = { ip: '127.0.0.1' };

        for (let index = 0; index < 2; index += 1) {
            const response = makeResponse();
            const next = jest.fn();
            limiter(request, response, next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(response.statusCode).toBe(200);
        }

        const limitedResponse = makeResponse();
        const next = jest.fn();
        limiter(request, limitedResponse, next);
        expect(next).not.toHaveBeenCalled();
        expect(limitedResponse.statusCode).toBe(429);
        expect(limitedResponse.headers['Retry-After']).toBe('60');

        timestamp += 60001;
        const resetResponse = makeResponse();
        limiter(request, resetResponse, next);
        expect(resetResponse.statusCode).toBe(200);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
