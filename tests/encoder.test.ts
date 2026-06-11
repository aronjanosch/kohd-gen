import { describe, expect, it } from 'vitest';
import { encodeWord } from '../src/encoder/word';
import { placeLetter } from '../src/grid';

// Node ids, row-major: 0=ABC 1=DEF 2=GHI 3=JKL 4=MNO 5=PQR 6=STU 7=VWX 8=YZ

describe('placeLetter', () => {
  it('maps the grid row-major with 1-based slots', () => {
    expect(placeLetter('A')).toEqual({ letter: 'A', node: 0, slot: 1 });
    expect(placeLetter('M')).toEqual({ letter: 'M', node: 4, slot: 1 });
    expect(placeLetter('O')).toEqual({ letter: 'O', node: 4, slot: 3 });
    expect(placeLetter('T')).toEqual({ letter: 'T', node: 6, slot: 2 });
    expect(placeLetter('Y')).toEqual({ letter: 'Y', node: 8, slot: 1 });
    expect(placeLetter('Z')).toEqual({ letter: 'Z', node: 8, slot: 2 });
    expect(placeLetter('3')).toBeNull();
  });
});

describe('encodeWord MOTHERBOARD (book example)', () => {
  const c = encodeWord('Motherboard');

  it('starts the charge at MNO', () => {
    expect(c.charge.node).toBe(4);
  });

  it('puts M and O dot groups on the first trace toward STU', () => {
    const t0 = c.traces[0]!;
    expect(t0.from).toEqual({ node: 4, ring: 0 });
    expect(t0.to).toEqual({ node: 6, ring: 0 });
    expect(t0.dotGroups).toEqual([
      { letter: 'M', count: 1 },
      { letter: 'O', count: 3 },
    ]);
  });

  it('walks T->H->E->R->B then revisits via rings (O, A, R, D)', () => {
    const hops = c.traces.map((t) => [t.from.node, t.from.ring, t.to.node, t.to.ring]);
    expect(hops).toEqual([
      [4, 0, 6, 0], // charge MNO -> STU (T)
      [6, 0, 2, 0], // -> GHI (H)
      [2, 0, 1, 0], // -> DEF (E)
      [1, 0, 5, 0], // -> PQR (R)
      [5, 0, 0, 0], // -> ABC (B)
      [0, 0, 4, 1], // -> MNO ring 1 (O) — book: "draw a ring around the MNO node"
      [4, 1, 0, 1], // -> ABC ring 1 (A)
      [0, 1, 5, 1], // -> PQR ring 1 (R)
      [5, 1, 1, 1], // -> DEF ring 1 (D)
    ]);
  });

  it('grounds at DEF ring 1 with the single D dot', () => {
    expect(c.ground.port).toEqual({ node: 1, ring: 1 });
    expect(c.ground.dotGroups).toEqual([{ letter: 'D', count: 1 }]);
  });

  it('uses 6 nodes spanning the full grid: no null modifier', () => {
    expect(Object.keys(c.nodes).length).toBe(6);
    expect(c.nullModifier).toBe(false);
  });
});

describe('encodeWord FELLED (null-modifier book example)', () => {
  const c = encodeWord('FELLED');

  it('uses only DEF and JKL', () => {
    expect(Object.keys(c.nodes).map(Number).sort()).toEqual([1, 3]);
  });

  it('stacks F+E on the outgoing trace, L+L on the return to a ring', () => {
    expect(c.traces.map((t) => t.dotGroups.map((g) => `${g.letter}${g.count}`))).toEqual([
      ['F3', 'E2'],
      ['L3', 'L3'],
    ]);
    expect(c.traces[1]!.to).toEqual({ node: 1, ring: 1 });
  });

  it('puts trailing same-node letters E and D on the ground', () => {
    expect(c.ground.dotGroups).toEqual([
      { letter: 'E', count: 2 },
      { letter: 'D', count: 1 },
    ]);
  });

  it('needs a null modifier (2-node diagonal)', () => {
    expect(c.nullModifier).toBe(true);
  });
});

describe('encodeWord QUANTUM', () => {
  const c = encodeWord('QUANTUM');

  it('chains PQR->STU->ABC->MNO->STU(ring1)->MNO(ring1) with revisit rings', () => {
    // Q(5,2) U(6,3) A(0,1) N(4,2) T(6,2) U(6,3) M(4,1)
    const hops = c.traces.map((t) => [t.from.node, t.from.ring, t.to.node, t.to.ring]);
    expect(hops).toEqual([
      [5, 0, 6, 0], // Q -> U
      [6, 0, 0, 0], // U -> A
      [0, 0, 4, 0], // A -> N
      [4, 0, 6, 1], // N -> T (STU ring 1)
      [6, 1, 4, 1], // T,U -> M (MNO ring 1)
    ]);
    expect(c.traces[4]!.dotGroups).toEqual([
      { letter: 'T', count: 2 },
      { letter: 'U', count: 3 },
    ]);
    expect(c.ground.dotGroups).toEqual([{ letter: 'M', count: 1 }]);
    expect(c.nullModifier).toBe(false);
  });
});

describe('single-node words', () => {
  it('NO has no traces; both dots ride the ground', () => {
    const c = encodeWord('NO');
    expect(c.traces).toEqual([]);
    expect(c.ground.dotGroups).toEqual([
      { letter: 'N', count: 2 },
      { letter: 'O', count: 3 },
    ]);
    expect(c.nullModifier).toBe(true);
  });
});
