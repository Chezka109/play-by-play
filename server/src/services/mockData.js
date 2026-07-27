const { parsePlayText } = require('../parsers/playParser');

const mockPlayTexts = [
    'M. Stafford pass short right to K. Williams for 20 yards',
    'J. Hurts up the middle for no gain',
    'P. Mahomes pass incomplete short left',
    'J. Allen sacked at BUF 18 for -7 yards',
    'T. Tagovailoa pass deep middle intended for T. Hill INTERCEPTED by D. Slay at MIA 40. D. Slay return for 10 yards',
    'Penalty on DAL: Holding (Offense) 10 yards',
    'C. McCaffrey left end for 5 yards, TOUCHDOWN',
];

function getMockPlays() {
    return mockPlayTexts.map((text, idx) => {
        const parsed = parsePlayText(text);
        return {
            id: `mock-${idx + 1}`,
            text,
            quarter: 1,
            clock: '15:00',
            down: null,
            distance: null,
            yardLine: null,
            possessionText: null,
            team: null,
            typeText: null,
            parsed,
            explanation: null,
        };
    });
}

module.exports = { getMockPlays };
