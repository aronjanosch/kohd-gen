import { describe, expect, it } from 'vitest';
import { encodeWord } from '../src/encoder/word';
import { checkInvariants } from '../src/layout/invariants';
import { routeWord } from '../src/layout/router';

const GOLDEN = ['MOTHERBOARD', 'QUANTUM', 'FELLED', 'MOUNT', 'HOMING', 'NETWORK', 'COMMUNICATION', 'CITY', 'CARRIES', 'NO'];

// A rough cross-section of English: lengths, repeats, rare letters.
const DICTIONARY = [
  'ECHO', 'VALE', 'REMNANT', 'TECHNOMANCER', 'PILGRIM', 'SERAPH', 'QUANTUM', 'ALCHEMY',
  'MACHINE', 'LANGUAGE', 'CIRCUIT', 'CHARGE', 'GROUND', 'SUBNODE', 'TRACE', 'GLYPH',
  'ZIGZAG', 'JAZZ', 'QUIZZICAL', 'ONOMATOPOEIA', 'STRENGTHS', 'RHYTHM', 'SPHINX',
  'JUKEBOX', 'WALTZ', 'OXYGEN', 'KAYAK', 'BANANA', 'MISSISSIPPI', 'ABRACADABRA',
  'ELECTROENCEPHALOGRAPH', 'A', 'I', 'AT', 'TO', 'ZZZ', 'AAA', 'XYLOPHONE', 'WIZARD',
];

describe('router invariants', () => {
  for (const word of [...new Set([...GOLDEN, ...DICTIONARY])]) {
    it(`routes ${word} without overlap or keep-out violations`, () => {
      const g = routeWord(encodeWord(word));
      const violations = checkInvariants(g);
      expect(violations, violations.map((x) => `${x.rule}: ${x.detail}`).join('\n')).toEqual([]);
    });
  }
});

describe('router determinism', () => {
  it('produces byte-identical geometry on repeated runs', () => {
    const a = JSON.stringify(routeWord(encodeWord('MOTHERBOARD')));
    const b = JSON.stringify(routeWord(encodeWord('MOTHERBOARD')));
    expect(a).toBe(b);
  });
});

describe('router structure', () => {
  it('gives MOTHERBOARD one perimeter route (the long STU->GHI hop)', () => {
    const g = routeWord(encodeWord('MOTHERBOARD'));
    const long = g.traces.filter((t) => t.path.pts.length > 4);
    expect(long.length).toBe(1);
    expect(long[0]!.spec.from.node).toBe(6);
    expect(long[0]!.spec.to.node).toBe(2);
  });

  it('bundles FELLED traces into parallel lanes', () => {
    const g = routeWord(encodeWord('FELLED'));
    expect(g.traces.length).toBe(2);
    // Both runs have the 4-point jog-straight-jog shape.
    for (const t of g.traces) expect(t.path.pts.length).toBe(4);
  });
});
