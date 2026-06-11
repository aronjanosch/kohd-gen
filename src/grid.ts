/**
 * The kohd node grid, row-major:
 *   ABC DEF GHI
 *   JKL MNO PQR
 *   STU VWX YZ
 * Each node holds up to 3 letters; a letter's position within its node
 * (1st/2nd/3rd) is its "slot" and becomes the subnode dot count.
 */

export type NodeId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Slot = 1 | 2 | 3;

export interface LetterPlacement {
  letter: string;
  node: NodeId;
  slot: Slot;
}

export function placeLetter(ch: string): LetterPlacement | null {
  const code = ch.toUpperCase().charCodeAt(0) - 65; // A=0 .. Z=25
  if (code < 0 || code > 25) return null;
  const node = Math.min(Math.floor(code / 3), 8) as NodeId;
  const slot = ((code - node * 3) + 1) as Slot;
  return { letter: ch.toUpperCase(), node, slot };
}

export function nodeCol(n: NodeId): 0 | 1 | 2 {
  return (n % 3) as 0 | 1 | 2;
}

export function nodeRow(n: NodeId): 0 | 1 | 2 {
  return Math.floor(n / 3) as 0 | 1 | 2;
}

/** Letters of a node, for labels/debugging. */
export function nodeLetters(n: NodeId): string {
  return ['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZ'][n]!;
}
