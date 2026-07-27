function clean(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
}

function findDirection(t) {
    const lower = t.toLowerCase();
    if (/(up the middle|middle)/.test(lower)) return 'middle';
    if (/\bleft\b/.test(lower)) return 'left';
    if (/\bright\b/.test(lower)) return 'right';
    return null;
}

function findYards(t) {
    const lower = t.toLowerCase();

    if (/for no gain/.test(lower)) return 0;

    const loss = lower.match(/loss of (\d+) yards?/);
    if (loss) return -Number(loss[1]);

    const forYards = lower.match(/for (-?\d+) yards?/);
    if (forYards) return Number(forYards[1]);

    const gain = lower.match(/(-?\d+)[- ]yard gain/);
    if (gain) return Number(gain[1]);

    const sack = lower.match(/sacked.* for (-?\d+) yards?/);
    if (sack) return Number(sack[1]);

    return null;
}

function findNameAfter(prefixRegex, t) {
    const m = t.match(prefixRegex);
    if (!m) return null;
    const raw = m[1] || '';
    return raw.replace(/\s+/g, ' ').trim() || null;
}

function parsePlayText(text) {
    const raw = clean(text);
    const lower = raw.toLowerCase();

    const isPenalty = /\bpenalty\b|\bno play\b/.test(lower);
    const isTouchdown = /\btouchdown\b/.test(lower);
    const isInterception = /\bintercepted\b/.test(lower);
    const isIncomplete = /\bincomplete\b/.test(lower);
    const isSack = /\bsacked\b/.test(lower);

    let type = 'unknown';
    if (isPenalty) type = 'penalty';
    else if (isInterception) type = 'interception';
    else if (isSack) type = 'sack';
    else if (isIncomplete) type = 'incomplete';
    else if (/\bpass\b|\bpasses\b|\bpass short\b|\bpass deep\b/.test(lower)) type = 'pass';
    else if (/\brush\b|\bup the middle\b|\bleft end\b|\bright end\b|\bscramble\b|\bruns\b/.test(lower)) type = 'rush';

    const direction = findDirection(raw);
    const yards = findYards(raw);

    const players = {};

    // Common name format: "M. Stafford" or "M.Stafford"
    // Passer: "X. Name pass ..."
    const passer = findNameAfter(/^([A-Z]\.?\s?[A-Za-z'\-]+)\s+pass\b/i, raw);
    if (passer) players.passer = passer;

    const receiver = findNameAfter(/\bto\s+([A-Z]\.?\s?[A-Za-z'\-]+)\b/i, raw);
    if (receiver) players.receiver = receiver;

    const rusher = findNameAfter(/^([A-Z]\.?\s?[A-Za-z'\-]+)\s+(?:left|right|up the middle|scramble|rush|runs)\b/i, raw);
    if (rusher) players.rusher = rusher;

    const interceptor = findNameAfter(/\bintercepted\s+by\s+([A-Z]\.?\s?[A-Za-z'\-]+)\b/i, raw);
    if (interceptor) players.interceptor = interceptor;

    return {
        raw,
        type,
        direction,
        yards,
        isTouchdown,
        players,
    };
}

module.exports = { parsePlayText };
