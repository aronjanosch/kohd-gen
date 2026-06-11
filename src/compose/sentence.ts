import { routeWord } from '../layout/router';
import { add, dist, norm, scale, sub, v } from '../layout/vec';
import { lexiconHalfWidth } from '../render/symbols';
import type { PlacedSymbol, Polyline, SentencePlan, Vec, WordGeometry } from '../types';

export interface PlacedWord {
  geom: WordGeometry;
  offset: Vec;
}

export interface Connector {
  path: Polyline;
  /** Perpendicular end bars ("connections always begin and terminate in a simple bar"). */
  bars: { at: Vec; dir: Vec }[];
  /** Optional comma mark on this connector. */
  comma?: { at: Vec; dir: Vec };
}

export interface SentenceGeometry {
  words: PlacedWord[];
  symbols: PlacedSymbol[];
  connectors: Connector[];
  bbox: { min: Vec; max: Vec };
}

const WORD_GAP = 56;
const COUPLER_GAP = 48;
const STEP = 14;

interface Endpoint {
  at: Vec;
  dir: Vec; // outward
  bottom: number;
  top: number;
}

/** Lay out a parsed sentence: coupler, word glyphs, lexicon symbols, connectors. */
export function composeSentence(plan: SentencePlan): SentenceGeometry {
  const words: PlacedWord[] = [];
  const symbols: PlacedSymbol[] = [];
  const connectors: Connector[] = [];

  interface Slot {
    inPt: Endpoint;
    outPt: Endpoint;
  }
  const slots: Slot[] = [];
  let cursor = 0;
  let commaAfterSlot = -2;
  for (const item of plan.items) {
    if (item.kind === 'comma') {
      commaAfterSlot = slots.length - 1;
      continue;
    }
    if (item.kind === 'lexicon') {
      const half = lexiconHalfWidth(item.symbol);
      const cx = cursor + half;
      symbols.push({ kind: item.symbol, at: v(cx, 0), rotation: 0 });
      slots.push({
        inPt: { at: v(cx - half - 2, 0), dir: v(-1, 0), bottom: 24, top: -24 },
        outPt: { at: v(cx + half + 2, 0), dir: v(1, 0), bottom: 24, top: -24 },
      });
      cursor += half * 2 + WORD_GAP;
      continue;
    }
    const geom = routeWord(item.circuit);
    const h = geom.bbox.max.y - geom.bbox.min.y;
    const offset = v(cursor - geom.bbox.min.x, -geom.bbox.min.y - h / 2);
    words.push({ geom, offset });
    slots.push({
      inPt: {
        at: add(geom.chargeAnchor, offset),
        dir: geom.chargeDir,
        bottom: geom.bbox.max.y + offset.y,
        top: geom.bbox.min.y + offset.y,
      },
      outPt: {
        at: add(geom.groundAnchor, offset),
        dir: geom.groundDir,
        bottom: geom.bbox.max.y + offset.y,
        top: geom.bbox.min.y + offset.y,
      },
    });
    cursor += geom.bbox.max.x - geom.bbox.min.x + WORD_GAP;
  }

  if (slots.length === 0) {
    return { words, symbols, connectors, bbox: { min: v(0, 0), max: v(0, 0) } };
  }

  // Coupler at the far left, aligned with the first item's inbound anchor.
  const first = slots[0]!.inPt;
  const couplerAt = v(-COUPLER_GAP, first.at.y);
  symbols.push({ kind: 'coupler', at: couplerAt, rotation: 0 });
  connectors.push(routeConnector({ at: couplerAt, dir: v(1, 0), bottom: 40, top: -44 }, first, false));

  for (let i = 1; i < slots.length; i++) {
    const out = slots[i - 1]!.outPt;
    const inn = slots[i]!.inPt;
    const conn = routeConnector(out, inn, true);
    if (commaAfterSlot === i - 1) {
      const mid = longestSegmentMid(conn.path);
      if (mid) conn.comma = mid;
    }
    connectors.push(conn);
  }

  // bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (p: Vec, pad = 0) => {
    minX = Math.min(minX, p.x - pad);
    minY = Math.min(minY, p.y - pad);
    maxX = Math.max(maxX, p.x + pad);
    maxY = Math.max(maxY, p.y + pad);
  };
  for (const w of words) {
    eat(add(w.geom.bbox.min, w.offset));
    eat(add(w.geom.bbox.max, w.offset));
  }
  for (const s of symbols) eat(s.at, 48);
  for (const conn of connectors) for (const p of conn.path.pts) eat(p, 4);
  return { words, symbols, connectors, bbox: { min: v(minX, minY), max: v(maxX, maxY) } };
}

/**
 * Route a connector from an outbound endpoint to the next inbound endpoint.
 * Steps outward from both ends, then links them with an orthogonal path that
 * dips below the glyphs when the direct corridor is blocked.
 */
function routeConnector(out: Endpoint, inn: Endpoint, withBars: boolean): Connector {
  const a = out.at;
  const b = inn.at;
  const a1 = add(a, scale(out.dir, STEP));
  const b1 = add(b, scale(inn.dir, STEP));

  let mid: Vec[];
  if (Math.abs(a1.y - b1.y) < 8 && b1.x - a1.x > 0 && pointsHorizontal(out, inn)) {
    // Facing anchors at the same height: straight across.
    mid = [];
  } else {
    // Dip through the channel below both glyphs.
    const chanY = Math.max(out.bottom, inn.bottom) + 26;
    mid = [v(a1.x, chanY), v(b1.x, chanY)];
  }

  const pts = dedupe([a, a1, ...mid, b1, b]);
  const conn: Connector = { path: { pts: chamfer(pts, 9) }, bars: [] };
  if (withBars) {
    conn.bars.push({ at: a, dir: out.dir });
    conn.bars.push({ at: b, dir: inn.dir });
  } else {
    conn.bars.push({ at: b, dir: inn.dir });
  }
  return conn;
}

function pointsHorizontal(out: Endpoint, inn: Endpoint): boolean {
  return out.dir.x > 0.7 && inn.dir.x < -0.7;
}

function longestSegmentMid(path: Polyline): { at: Vec; dir: Vec } | undefined {
  let best: { at: Vec; dir: Vec } | undefined;
  let bestLen = 24; // commas need a reasonably long run
  for (let i = 1; i < path.pts.length; i++) {
    const p = path.pts[i - 1]!;
    const q = path.pts[i]!;
    const l = dist(p, q);
    if (l > bestLen) {
      bestLen = l;
      best = { at: scale(add(p, q), 0.5), dir: norm(sub(q, p)) };
    }
  }
  return best;
}

function chamfer(pts: Vec[], cut: number): Vec[] {
  if (pts.length < 3) return pts;
  const out: Vec[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    const c1 = Math.min(cut, dist(prev, cur) / 2);
    const c2 = Math.min(cut, dist(cur, next) / 2);
    out.push(add(cur, scale(norm(sub(prev, cur)), c1)));
    out.push(add(cur, scale(norm(sub(next, cur)), c2)));
  }
  out.push(pts[pts.length - 1]!);
  return dedupe(out);
}

function dedupe(pts: Vec[]): Vec[] {
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]!) > 0.5);
}
