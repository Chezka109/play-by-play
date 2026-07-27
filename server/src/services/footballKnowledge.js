const { parsePlayText } = require('../parsers/playParser');

const FOOTBALL_GLOSSARY = {
    blitz: 'A defensive rush that sends extra defenders toward the quarterback.',
    completion: 'A forward pass caught legally by an eligible offensive player.',
    down: 'One of the offense’s four chances to move the ball at least 10 yards.',
    'first down': 'A new set of four downs earned by moving the ball at least 10 yards.',
    fumble: 'The ball comes loose before the ball carrier is down.',
    interception: 'A defender catches a pass thrown by the opposing quarterback.',
    'line of scrimmage': 'The imaginary line where the ball is placed before the snap.',
    penalty: 'A rule violation that can add or remove yards or erase the play.',
    possession: 'Control of the ball and the right to run an offensive play.',
    quarterback: 'The player who usually receives the snap and directs the offense.',
    receiver: 'An eligible offensive player whose job often includes catching passes.',
    'red zone': 'The final 20 yards before the opponent’s goal line.',
    rush: 'A play where a player carries the ball instead of throwing it forward.',
    sack: 'A tackle of the quarterback behind the line of scrimmage before a pass.',
    scramble: 'A quarterback run that begins after a passing play breaks down.',
    snap: 'The motion that starts a play by sending the ball to a backfield player.',
    tackle: 'Stopping a ball carrier by bringing them down or forcing the play dead.',
    touchdown: 'A six-point score made by carrying or catching the ball in the end zone.',
    turnover: 'A play that gives possession of the ball to the other team.',
};

function normalizeTerm(term) {
    return String(term || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function lookupFootballTerms(terms, { limit = 6 } = {}) {
    const seen = new Set();
    const definitions = [];

    for (const rawTerm of terms || []) {
        const term = normalizeTerm(rawTerm);
        if (!term || seen.has(term) || !FOOTBALL_GLOSSARY[term]) continue;
        seen.add(term);
        definitions.push({ term, definition: FOOTBALL_GLOSSARY[term] });
        if (definitions.length >= limit) break;
    }

    return definitions;
}

function inferRelevantTerms(play, parsed) {
    const text = String(play?.text || '').toLowerCase();
    const terms = new Set();

    if (['pass', 'incomplete', 'interception', 'sack'].includes(parsed.type)) {
        terms.add('quarterback');
    }
    if (['pass', 'incomplete', 'interception'].includes(parsed.type)) {
        terms.add('receiver');
    }
    if (parsed.type === 'pass') terms.add('completion');
    if (parsed.type === 'rush') terms.add('rush');
    if (parsed.type === 'sack') terms.add('sack');
    if (parsed.type === 'interception') {
        terms.add('interception');
        terms.add('turnover');
    }
    if (parsed.type === 'penalty') terms.add('penalty');
    if (parsed.touchdown) terms.add('touchdown');
    if (/fumble/i.test(text)) {
        terms.add('fumble');
        terms.add('turnover');
    }
    if (/scrambl/i.test(text)) terms.add('scramble');
    if (/blitz/i.test(text)) terms.add('blitz');
    if (Number(play?.yardLine) >= 80) terms.add('red zone');
    if (
        Number.isFinite(parsed.yards) &&
        Number.isFinite(Number(play?.distance)) &&
        parsed.yards >= Number(play.distance)
    ) {
        terms.add('first down');
    }
    terms.add('down');
    terms.add('line of scrimmage');

    return [...terms];
}

function inspectPlay(request) {
    const play = request.play || {};
    const parsed = play.parsed || parsePlayText(play.text);
    const relevantTerms = inferRelevantTerms(play, parsed);

    return {
        parsed,
        situation: {
            quarter: play.quarter ?? null,
            clock: play.clock ?? null,
            down: play.down ?? null,
            distance: play.distance ?? null,
            yardLine: play.yardLine ?? null,
            possessionText: play.possessionText ?? null,
            team: play.team ?? null,
        },
        recentPlays: (request.recentPlays || []).slice(-5).map((recentPlay) => ({
            text: recentPlay.text || '',
            quarter: recentPlay.quarter ?? null,
            clock: recentPlay.clock ?? null,
            down: recentPlay.down ?? null,
            distance: recentPlay.distance ?? null,
        })),
        game: request.game || null,
        glossary: lookupFootballTerms(relevantTerms),
    };
}

module.exports = {
    FOOTBALL_GLOSSARY,
    inferRelevantTerms,
    inspectPlay,
    lookupFootballTerms,
};
