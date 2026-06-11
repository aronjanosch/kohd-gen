import type { NodeId, Slot } from './grid';

/* ---------- Semantic IR: output of the encoder ---------- */

/** A connection point: ring 0 is the node circle itself, ring k the k-th revisit ring. */
export interface PortRef {
  node: NodeId;
  ring: number;
}

/** One letter's subnode dots; groups are rendered in order with gaps between them. */
export interface DotGroup {
  letter: string;
  count: Slot;
}

export interface TraceSpec {
  /** Circuit order, 0-based; drives deterministic routing. */
  seq: number;
  from: PortRef;
  to: PortRef;
  /** Dot groups riding this trace (letters that "left" from `from`). */
  dotGroups: DotGroup[];
}

export type Punctuation = '.' | '!' | '?';
export type Article = 'a' | 'the';

export interface WordCircuit {
  word: string;
  /** Only the nodes used by the word; rings = number of revisit rings. */
  nodes: Partial<Record<NodeId, { rings: number }>>;
  traces: TraceSpec[];
  charge: { node: NodeId; article?: Article };
  ground: { port: PortRef; dotGroups: DotGroup[]; punctuation?: Punctuation };
  /** True when the used-node pattern fits the 3x3 grid in more than one position. */
  nullModifier: boolean;
}

/* ---------- Geometry IR: output of the router ---------- */

export interface Vec {
  x: number;
  y: number;
}

/** Octilinear polyline; corners already generated. */
export interface Polyline {
  pts: Vec[];
}

export interface Dot {
  center: Vec;
  r: number;
}

export interface RoutedTrace {
  spec: TraceSpec;
  path: Polyline;
  dots: Dot[];
}

export interface Circle {
  center: Vec;
  r: number;
  nodeId: NodeId;
  ring: number;
}

export type SymbolKind =
  | 'charge'
  | 'ground'
  | 'nullModifier'
  | 'articleA'
  | 'articleThe'
  | 'coupler'
  | 'comma'
  | 'period'
  | 'exclaim'
  | 'question'
  | LexiconKind;

export type LexiconKind =
  | 'and'
  | 'or'
  | 'true'
  | 'false'
  | 'because'
  | 'so'
  | 'if'
  | 'ifThen'
  | 'thereIs'
  | 'unique'
  | 'fromTo'
  | 'you'
  | 'iMe'
  | 'youAll'
  | 'we'
  | 'themSg'
  | 'themPl'
  | 'theirSg'
  | 'theirPl';

export interface PlacedSymbol {
  kind: SymbolKind;
  at: Vec;
  /** Rotation in degrees, clockwise, around `at`. */
  rotation: number;
}

export interface WordGeometry {
  word: string;
  circles: Circle[];
  traces: RoutedTrace[];
  /** Ground stub path with the final letter dots on it. */
  groundStub: { path: Polyline; dots: Dot[] };
  /** Charge stub path (line into the zigzag symbol). */
  chargeStub: { path: Polyline };
  symbols: PlacedSymbol[];
  /** Where an inbound sentence connector attaches (at the charge). */
  chargeAnchor: Vec;
  /** Outward direction of the charge stub. */
  chargeDir: Vec;
  /** Where the outbound sentence connector leaves (after the ground). */
  groundAnchor: Vec;
  /** Outward direction of the ground stub. */
  groundDir: Vec;
  bbox: { min: Vec; max: Vec };
}

/* ---------- Sentence IR ---------- */

export type SentenceItem =
  | { kind: 'word'; circuit: WordCircuit }
  | { kind: 'lexicon'; symbol: LexiconKind }
  | { kind: 'comma' };

export interface SentencePlan {
  items: SentenceItem[];
}
