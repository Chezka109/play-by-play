class TtlCache {
    constructor({ maxSize = 5000, ttlMs = 1000 * 60 * 60 * 24 * 30 } = {}) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.map = new Map();
    }

    _now() {
        return Date.now();
    }

    _evictIfNeeded() {
        while (this.map.size > this.maxSize) {
            const firstKey = this.map.keys().next().value;
            this.map.delete(firstKey);
        }
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this._now()) {
            this.map.delete(key);
            return undefined;
        }
        // refresh LRU-ish
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        const expiresAt = this._now() + this.ttlMs;
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { value, expiresAt });
        this._evictIfNeeded();
    }
}

module.exports = { TtlCache };
