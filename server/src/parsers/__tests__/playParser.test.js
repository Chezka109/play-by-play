const { parsePlayText } = require('../playParser');

describe('parsePlayText', () => {
    test('parses a completed pass with direction and yards', () => {
        const p = parsePlayText('M. Stafford pass short right to K. Williams for 20 yards');
        expect(p.type).toBe('pass');
        expect(p.direction).toBe('right');
        expect(p.yards).toBe(20);
        expect(p.players.passer).toMatch(/Stafford/);
        expect(p.players.receiver).toMatch(/Williams/);
    });

    test('parses incomplete pass', () => {
        const p = parsePlayText('P. Mahomes pass incomplete short left');
        expect(p.type).toBe('incomplete');
        expect(p.direction).toBe('left');
    });

    test('parses rush no gain', () => {
        const p = parsePlayText('J. Hurts up the middle for no gain');
        expect(p.type).toBe('rush');
        expect(p.direction).toBe('middle');
        expect(p.yards).toBe(0);
        expect(p.players.rusher).toMatch(/Hurts/);
    });

    test('parses sack with negative yards', () => {
        const p = parsePlayText('J. Allen sacked at BUF 18 for -7 yards');
        expect(p.type).toBe('sack');
        expect(p.yards).toBe(-7);
    });

    test('parses interception', () => {
        const p = parsePlayText(
            'T. Tagovailoa pass deep middle intended for T. Hill INTERCEPTED by D. Slay at MIA 40'
        );
        expect(p.type).toBe('interception');
        expect(p.direction).toBe('middle');
        expect(p.players.interceptor).toMatch(/Slay/);
    });

    test('parses penalty', () => {
        const p = parsePlayText('Penalty on DAL: Holding (Offense) 10 yards');
        expect(p.type).toBe('penalty');
    });

    test('parses touchdown', () => {
        const p = parsePlayText('C. McCaffrey left end for 5 yards, TOUCHDOWN');
        expect(p.type).toBe('rush');
        expect(p.isTouchdown).toBe(true);
        expect(p.direction).toBe('left');
        expect(p.yards).toBe(5);
    });
});
