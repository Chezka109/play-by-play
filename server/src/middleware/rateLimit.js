function createRateLimiter({
    windowMs,
    max,
    keyGenerator = (req) => req.ip || 'unknown',
    now = () => Date.now(),
} = {}) {
    const buckets = new Map();

    return function rateLimit(req, res, next) {
        const currentTime = now();
        const key = String(keyGenerator(req));
        let bucket = buckets.get(key);

        if (!bucket || bucket.resetAt <= currentTime) {
            bucket = { count: 0, resetAt: currentTime + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;
        const remaining = Math.max(0, max - bucket.count);
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((bucket.resetAt - currentTime) / 1000)
        );

        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (buckets.size > 10000) {
            for (const [bucketKey, value] of buckets) {
                if (value.resetAt <= currentTime) buckets.delete(bucketKey);
            }
        }

        if (bucket.count > max) {
            res.setHeader('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                error: 'Too many explanation requests',
                retryAfterSeconds,
            });
        }

        return next();
    };
}

module.exports = { createRateLimiter };
