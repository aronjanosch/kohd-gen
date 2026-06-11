import { placeLetter, nodeCol, nodeRow, type NodeId } from '../grid';
import type { Article, DotGroup, PortRef, Punctuation, TraceSpec, WordCircuit } from '../types';

/**
 * Encode a single word into its kohd circuit.
 *
 * Rules (campaign frame, "Writing in Kohd"):
 * - The first letter's node is the charge node.
 * - Each letter contributes a dot group (count = slot) on the trace that
 *   leaves its node; consecutive letters on the same node stack their groups
 *   on that same outgoing trace.
 * - Moving to an already-visited node connects to a new ring on that node.
 * - The final letter's dots (plus any trailing same-node letters') go on the
 *   ground indicator.
 * - A word whose used nodes don't pin down their position on the 3x3 grid
 *   gets a null modifier.
 */
export function encodeWord(
  word: string,
  opts: { article?: Article; punctuation?: Punctuation } = {},
): WordCircuit {
  const placements = [...word]
    .map(placeLetter)
    .filter((p): p is NonNullable<typeof p> => p !== null);
  if (placements.length === 0) {
    throw new Error(`Word "${word}" contains no letters A-Z`);
  }

  const ringCount = new Map<NodeId, number>();
  const first = placements[0]!;
  ringCount.set(first.node, 0);

  const traces: TraceSpec[] = [];
  let pending: DotGroup[] = [];
  let cur: PortRef = { node: first.node, ring: 0 };

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    pending.push({ letter: p.letter, count: p.slot });
    const next = placements[i + 1];
    if (next && next.node !== p.node) {
      const revisit = ringCount.has(next.node);
      const ring = revisit ? ringCount.get(next.node)! + 1 : 0;
      ringCount.set(next.node, ring);
      const to: PortRef = { node: next.node, ring };
      traces.push({ seq: traces.length, from: cur, to, dotGroups: pending });
      pending = [];
      cur = to;
    }
  }

  const nodes: WordCircuit['nodes'] = {};
  for (const [node, rings] of ringCount) {
    nodes[node] = { rings };
  }

  return {
    word: word.toUpperCase(),
    nodes,
    traces,
    charge: { node: first.node, article: opts.article },
    ground: { port: cur, dotGroups: pending, punctuation: opts.punctuation },
    nullModifier: isAmbiguous([...ringCount.keys()]),
  };
}

/**
 * The glyph only preserves the *relative* positions of its nodes, so if the
 * used-node pattern fits the 3x3 grid in more than one translation, the
 * reader can't tell which nodes they are. A bounding box narrower than 3
 * columns allows horizontal shifts, shorter than 3 rows vertical shifts;
 * either alone makes the word ambiguous (book examples: FELLED, MOUNT,
 * HOMING — all 2-node diagonals).
 */
function isAmbiguous(usedNodes: NodeId[]): boolean {
  const cols = usedNodes.map(nodeCol);
  const rows = usedNodes.map(nodeRow);
  const w = Math.max(...cols) - Math.min(...cols) + 1;
  const h = Math.max(...rows) - Math.min(...rows) + 1;
  return w < 3 || h < 3;
}
