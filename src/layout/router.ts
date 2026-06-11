import { nodeCol, nodeRow, type NodeId } from '../grid';
import type { Circle, PlacedSymbol, Polyline, RoutedTrace, TraceSpec, Vec, WordCircuit, WordGeometry } from '../types';
import { CLEAR, LANE, MARGIN, PITCH, RING_GAP, R_NODE } from './constants';
import { dotRunLength, placeDots } from './dots';
import { add, dist, len, norm, perp, scale, sub, v } from './vec';

export function nodeCenter(n: NodeId): Vec {
  return v(MARGIN + nodeCol(n) * PITCH, MARGIN + nodeRow(n) * PITCH);
}

export function ringRadius(ring: number): number {
  return R_NODE + ring * RING_GAP;
}

const JOG = 10; // arc length reserved at each end of a bundled run for the connector jog
const PERIM_GAP = 38; // gap between outermost keep-out and the perimeter ring
const CHAMFER = 16; // 45-degree corner cut on perimeter rectangles
const MAX_SIDE_OFFSET = 52; // beyond this a blocked run goes to the perimeter instead
const MAX_SIDE_OFFSET_LONG = 30; // tighter shift budget for long hops
const CHARGE_STUB_LEN = 12;
const CHARGE_SYMBOL_LEN = 56;
const GROUND_LEAD = 16;
const GROUND_TAIL = 8;
const GROUND_SYMBOL_LEN = 26;

/**
 * Bundle router, modeled on the campaign frame plates:
 * - unobstructed traces run straight between their ports;
 * - near-parallel, near-collinear runs are re-aimed onto a shared axis and
 *   spread into parallel lanes, joined to their ports by short end jogs;
 * - runs blocked by another node's keep-out shift sideways past it;
 * - long blocked hops route around a perimeter rectangle with 45-degree
 *   corners.
 * Lane separation is structural, so traces can cross transversally but never
 * run on top of each other.
 */
export function routeWord(c: WordCircuit): WordGeometry {
  const usedNodes = Object.entries(c.nodes).map(([k, info]) => ({
    id: Number(k) as NodeId,
    center: nodeCenter(Number(k) as NodeId),
    rings: info.rings,
    keepOut: ringRadius(info.rings) + CLEAR,
  }));
  const byId = new Map(usedNodes.map((n) => [n.id, n]));

  const circles: Circle[] = usedNodes.flatMap((n) =>
    Array.from({ length: n.rings + 1 }, (_, ring) => ({
      center: n.center,
      r: ringRadius(ring),
      nodeId: n.id,
      ring,
    })),
  );

  // ---- classify each trace ----
  interface Run {
    spec: TraceSpec;
    a: Vec; // source node center
    b: Vec; // target node center
    rA: number;
    rB: number;
    dir: Vec;
    /** Sideways shift required to clear blocking keep-outs (0 if unobstructed). */
    baseOffset: number;
    perimeter: boolean;
    /** Filled in by lane assignment. */
    lane: number;
    axis?: { origin: Vec; dir: Vec };
  }

  const runs: Run[] = [];
  for (const spec of c.traces) {
    const a = nodeCenter(spec.from.node);
    const b = nodeCenter(spec.to.node);
    const dir = norm(sub(b, a));
    const blockers = usedNodes.filter(
      (n) =>
        n.id !== spec.from.node &&
        n.id !== spec.to.node &&
        pointSegDist(n.center, a, b) < n.keepOut + LANE,
    );
    let perimeter = false;
    if (blockers.length > 0) {
      const side = clearingOffset(a, dir, blockers, 0);
      // Short hops squeeze past with a sideways shift; long hops only get a
      // modest shift before they go around the outside, as in the book plates.
      const limit = dist(a, b) > PITCH * 1.6 ? MAX_SIDE_OFFSET_LONG : MAX_SIDE_OFFSET;
      if (side === null || Math.abs(side) > limit) perimeter = true;
    }
    runs.push({
      spec,
      a,
      b,
      rA: ringRadius(spec.from.ring),
      rB: ringRadius(spec.to.ring),
      dir,
      baseOffset: 0,
      perimeter,
      lane: 0,
    });
  }

  // ---- cluster collinear runs into bundles ----
  const straight = runs.filter((r) => !r.perimeter);
  const clusters = clusterRuns(straight);
  for (const cluster of clusters) {
    // Axis = line of the longest run in the cluster.
    const longest = cluster.reduce((m, r) => (dist(r.a, r.b) > dist(m.a, m.b) ? r : m));
    const axis = { origin: longest.a, dir: longest.dir };
    const p = perp(axis.dir);
    const ax = (r: Run) => {
      // Signed perpendicular position of the run's midpoint relative to the axis.
      const mid = scale(add(r.a, r.b), 0.5);
      const rel = sub(mid, axis.origin);
      return rel.x * p.x + rel.y * p.y;
    };
    const ordered = [...cluster].sort((q, r) => ax(q) - ax(r) || q.spec.seq - r.spec.seq);

    // Shift the whole bundle sideways past any used node sitting in the
    // interior of its span (e.g. MISSISSIPPI's GHI<->STU lanes sliding past
    // MNO). The bundle is treated as one fat trace of width (n-1)*LANE.
    const halfW = ((cluster.length - 1) / 2) * LANE;
    const proj = (pt: Vec) => (pt.x - axis.origin.x) * axis.dir.x + (pt.y - axis.origin.y) * axis.dir.y;
    const endpoints = cluster.flatMap((r) => [proj(r.a), proj(r.b)]);
    const pMin = Math.min(...endpoints);
    const pMax = Math.max(...endpoints);
    const interior = usedNodes.filter((n) => {
      const t = proj(n.center);
      if (t < pMin + 20 || t > pMax - 20) return false;
      const rel = sub(n.center, axis.origin);
      const aside = Math.abs(rel.x * p.x + rel.y * p.y);
      // Wide net: a node this far out still constrains where the bundle may
      // shift to, even if the unshifted bundle clears it.
      return aside < n.keepOut + halfW + MAX_SIDE_OFFSET + LANE;
    });
    let clusterOffset = 0;
    let members = ordered;
    if (interior.length > 0) {
      const off = clearingOffset(axis.origin, axis.dir, interior, halfW);
      if (off !== null && Math.abs(off) <= MAX_SIDE_OFFSET + halfW) {
        clusterOffset = off;
      } else {
        // Hemmed in on both sides: members individually blocked by an
        // interior node go around the perimeter instead.
        for (const r of ordered) {
          const own = new Set([r.spec.from.node, r.spec.to.node]);
          const blocked = interior.some(
            (n) => !own.has(n.id) && pointSegDist(n.center, r.a, r.b) < n.keepOut + 4,
          );
          if (blocked) r.perimeter = true;
        }
        members = ordered.filter((r) => !r.perimeter);
      }
    }

    const memberMid = (members.length - 1) / 2;
    members.forEach((r, i) => {
      r.lane = i - memberMid;
      r.axis = axis;
      r.baseOffset = clusterOffset;
    });
  }

  // ---- geometry per run ----
  const perimRect = perimeterRect(usedNodes);
  let perimUse = 0;
  const traces: RoutedTrace[] = [];
  for (const r of runs) {
    let path: Polyline;
    if (r.perimeter) {
      path = routePerimeter(r.a, r.rA, r.b, r.rB, grow(perimRect, perimUse * LANE), perimUse * LANE * 2.2);
      perimUse++;
    } else if (r.axis && (clustersHas(clusters, r) || r.baseOffset !== 0)) {
      path = routeBundled(r);
    } else {
      // Lone unobstructed run: straight port to port.
      const start = add(r.a, scale(r.dir, r.rA));
      const end = sub(r.b, scale(r.dir, r.rB));
      path = { pts: [start, end] };
    }
    const startPad = path.pts.length > 2 ? JOG + 8 : 10;
    const dots = placeDots(path, r.spec.dotGroups, startPad, 10);
    traces.push({ spec: r.spec, path, dots });
  }

  function clustersHas(cs: Run[][], r: Run): boolean {
    return cs.some((cl) => cl.length > 1 && cl.includes(r));
  }

  function routeBundled(r: Run): Polyline {
    const axis = r.axis!;
    const p = perp(axis.dir);
    const w = r.lane * LANE + r.baseOffset;
    const t = (pt: Vec) => (pt.x - axis.origin.x) * axis.dir.x + (pt.y - axis.origin.y) * axis.dir.y;
    const L = (tt: number) => add(add(axis.origin, scale(axis.dir, tt)), scale(p, w));
    let tA = t(r.a);
    let tB = t(r.b);
    const sign = tB >= tA ? 1 : -1;
    tA += sign * (r.rA + JOG);
    tB -= sign * (r.rB + JOG);
    let p1 = L(tA);
    let p2 = L(tB);
    if ((tB - tA) * sign < 8) {
      // Ports too close along the axis for a parallel section; collapse to a midpoint elbow.
      const tm = (tA + tB) / 2;
      p1 = L(tm);
      p2 = p1;
    }
    const portA = add(r.a, scale(norm(sub(p1, r.a)), r.rA));
    const portB = add(r.b, scale(norm(sub(p2, r.b)), r.rB));
    const pts = p2.x === p1.x && p2.y === p1.y ? [portA, p1, portB] : [portA, p1, p2, portB];
    return { pts };
  }

  // ---- indicators ----
  const symbols: PlacedSymbol[] = [];
  const allSegments: { a: Vec; b: Vec }[] = [];
  for (const tr of traces) {
    for (let i = 1; i < tr.path.pts.length; i++) {
      allSegments.push({ a: tr.path.pts[i - 1]!, b: tr.path.pts[i]! });
    }
  }

  const chargeNode = byId.get(c.charge.node)!;
  const chargeAz = pickAzimuth(
    [0, 4, 2, 6, 7, 5, 1, 3],
    chargeNode,
    usedNodes,
    allSegments,
    CHARGE_STUB_LEN + CHARGE_SYMBOL_LEN,
  );
  const chargeDir = azimuthDir(chargeAz);
  const chargeR = ringRadius(chargeNode.rings);
  const chargeStart = add(chargeNode.center, scale(chargeDir, chargeR));
  const chargeEnd = add(chargeStart, scale(chargeDir, CHARGE_STUB_LEN));
  symbols.push({ kind: 'charge', at: chargeEnd, rotation: chargeAz * 45 });
  if (c.charge.article) {
    symbols.push({
      kind: c.charge.article === 'a' ? 'articleA' : 'articleThe',
      at: chargeNode.center,
      rotation: 0,
    });
  }

  const groundNode = byId.get(c.ground.port.node)!;
  const gLen = GROUND_LEAD + dotRunLength(c.ground.dotGroups) + GROUND_TAIL;
  const groundAz = pickAzimuth(
    [2, 0, 4, 6, 1, 3, 5, 7],
    groundNode,
    usedNodes,
    allSegments.concat([{ a: chargeStart, b: geomChargeFar(chargeStart, chargeDir) }]),
    gLen + GROUND_SYMBOL_LEN,
  );
  const groundDir = azimuthDir(groundAz);
  const gStart = add(groundNode.center, scale(groundDir, ringRadius(c.ground.port.ring)));
  const gEnd = add(gStart, scale(groundDir, gLen));
  const groundPath: Polyline = { pts: [gStart, gEnd] };
  const groundStub = {
    path: groundPath,
    dots: placeDots(groundPath, c.ground.dotGroups, GROUND_LEAD, GROUND_TAIL),
  };
  symbols.push({ kind: 'ground', at: gEnd, rotation: groundAz * 45 });
  if (c.ground.punctuation) {
    const kind = c.ground.punctuation === '.' ? 'period' : c.ground.punctuation === '!' ? 'exclaim' : 'question';
    // Punctuation rides the ground axis, just past the ground bars (plate 08-58.2).
    symbols.push({
      kind,
      at: add(gEnd, scale(groundDir, GROUND_SYMBOL_LEN + 2)),
      rotation: groundAz * 45,
    });
  }

  if (c.nullModifier) {
    symbols.push({ kind: 'nullModifier', at: nullModifierPos(usedNodes.map((n) => n.center)), rotation: 0 });
  }

  const geom: WordGeometry = {
    word: c.word,
    circles,
    traces,
    groundStub,
    chargeStub: { path: { pts: [chargeStart, chargeEnd] } },
    symbols,
    chargeAnchor: add(chargeEnd, scale(chargeDir, CHARGE_SYMBOL_LEN)),
    chargeDir,
    groundAnchor: add(gEnd, scale(groundDir, GROUND_SYMBOL_LEN)),
    groundDir,
    bbox: { min: v(0, 0), max: v(0, 0) },
  };
  geom.bbox = computeBbox(geom);
  return geom;
}

/* ---------- obstruction handling ---------- */

/** Distance from point p to segment ab. */
export function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
  return dist(p, add(a, scale(ab, t)));
}

/**
 * Smallest signed sideways shift that moves the line (a, dir) clear of every
 * blocker's keep-out band, or null if the blockers hem it in on both sides.
 */
function clearingOffset(
  a: Vec,
  dir: Vec,
  blockers: { center: Vec; keepOut: number }[],
  halfWidth: number,
): number | null {
  const p = perp(dir);
  // Signed perpendicular distance of each blocker from the unshifted line;
  // shifting the line by o moves each to (d - o).
  const bands = blockers.map((blk) => {
    const rel = sub(blk.center, a);
    const d = rel.x * p.x + rel.y * p.y;
    // Reserve room for the bundle's lane spread on top of the keep-out.
    const req = blk.keepOut + 4 + halfWidth;
    return { lo: d - req, hi: d + req };
  });
  const lo = Math.min(...bands.map((band) => band.lo));
  const hi = Math.max(...bands.map((band) => band.hi));
  // Candidate shifts: just below all bands, or just above.
  const candidates = [lo, hi].filter((o) => bands.every((band) => o <= band.lo || o >= band.hi));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, o) => (Math.abs(o) < Math.abs(best) ? o : best));
}

/* ---------- clustering ---------- */

function clusterRuns<T extends { a: Vec; b: Vec; dir: Vec }>(runs: T[]): T[][] {
  // Runs bundle only when they share a corridor line: near-parallel AND all
  // four endpoints close to a common axis. Re-aiming anything farther off-axis
  // would create long shallow jogs that shadow neighboring lanes.
  const lineDist = (p: Vec, origin: Vec, dir: Vec): number => {
    const rel = sub(p, origin);
    return Math.abs(rel.x * dir.y - rel.y * dir.x);
  };
  const conflict = (r: T, s: T): boolean => {
    const cos = Math.abs(r.dir.x * s.dir.x + r.dir.y * s.dir.y);
    if (cos < Math.cos((25 * Math.PI) / 180)) return false;
    const tol = LANE * 3.2;
    if (lineDist(s.a, r.a, r.dir) > tol || lineDist(s.b, r.a, r.dir) > tol) return false;
    // Require real overlap along the shared direction, not just nearby endpoints.
    const t = (pt: Vec) => pt.x * r.dir.x + pt.y * r.dir.y;
    const [r1, r2] = [Math.min(t(r.a), t(r.b)), Math.max(t(r.a), t(r.b))];
    const [s1, s2] = [Math.min(t(s.a), t(s.b)), Math.max(t(s.a), t(s.b))];
    return Math.min(r2, s2) - Math.max(r1, s1) > R_NODE * 2;
  };

  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      if (conflict(runs[i]!, runs[j]!)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, T[]>();
  runs.forEach((r, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  });
  return [...groups.values()];
}

/* ---------- perimeter routing ---------- */

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function perimeterRect(nodes: { center: Vec; keepOut: number }[]): Rect {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of nodes) {
    x1 = Math.min(x1, n.center.x - n.keepOut);
    y1 = Math.min(y1, n.center.y - n.keepOut);
    x2 = Math.max(x2, n.center.x + n.keepOut);
    y2 = Math.max(y2, n.center.y + n.keepOut);
  }
  return { x1: x1 - PERIM_GAP, y1: y1 - PERIM_GAP, x2: x2 + PERIM_GAP, y2: y2 + PERIM_GAP };
}

function grow(r: Rect, by: number): Rect {
  return { x1: r.x1 - by, y1: r.y1 - by, x2: r.x2 + by, y2: r.y2 + by };
}

/** Corners clockwise from top-left. */
function corners(r: Rect): Vec[] {
  return [v(r.x1, r.y1), v(r.x2, r.y1), v(r.x2, r.y2), v(r.x1, r.y2)];
}

function projectToRect(p: Vec, r: Rect): { pt: Vec; side: number } {
  // side: 0 top, 1 right, 2 bottom, 3 left
  const cand: { pt: Vec; side: number; d: number }[] = [
    { pt: v(clamp(p.x, r.x1, r.x2), r.y1), side: 0, d: Math.abs(p.y - r.y1) },
    { pt: v(r.x2, clamp(p.y, r.y1, r.y2)), side: 1, d: Math.abs(p.x - r.x2) },
    { pt: v(clamp(p.x, r.x1, r.x2), r.y2), side: 2, d: Math.abs(p.y - r.y2) },
    { pt: v(r.x1, clamp(p.y, r.y1, r.y2)), side: 3, d: Math.abs(p.x - r.x1) },
  ];
  cand.sort((a, b) => a.d - b.d);
  return cand[0]!;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Route around the perimeter rectangle: escape from the source circle to the
 * nearest rect point, walk the shorter way around (45-degree chamfered
 * corners), drop back in at the target.
 */
function routePerimeter(a: Vec, rA: number, b: Vec, rB: number, rect: Rect, lateral: number): Polyline {
  const ea = projectToRect(a, rect);
  const eb = projectToRect(b, rect);
  // Spread the escape points of successive perimeter routes sideways so
  // routes sharing an endpoint node don't stack their escape stubs.
  const slide = (e: { pt: Vec; side: number }) => {
    const tangent = e.side % 2 === 0 ? v(1, 0) : v(0, 1);
    e.pt = add(e.pt, scale(tangent, lateral));
  };
  slide(ea);
  slide(eb);
  const cs = corners(rect);

  const walk = (dirSign: 1 | -1): Vec[] => {
    const pts: Vec[] = [ea.pt];
    let side = ea.side;
    while (side !== eb.side) {
      // Corner between `side` and the next side in walk direction.
      const cornerIdx = dirSign === 1 ? (side + 1) % 4 : side;
      pts.push(cs[cornerIdx]!);
      side = (side + dirSign + 4) % 4;
    }
    pts.push(eb.pt);
    return pts;
  };

  const lenOf = (pts: Vec[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1]!, p) : 0), 0);
  const cw = walk(1);
  const ccw = walk(-1);
  let pts = lenOf(cw) <= lenOf(ccw) ? cw : ccw;

  // Same-side shortcut: straight along the edge.
  if (ea.side === eb.side) pts = [ea.pt, eb.pt];

  pts = chamfer(pts, CHAMFER);
  const portA = add(a, scale(norm(sub(pts[0]!, a)), rA));
  const portB = add(b, scale(norm(sub(pts[pts.length - 1]!, b)), rB));
  return { pts: dedupe([portA, ...pts, portB]) };
}

/** Replace interior corners with 45-degree cuts. */
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

/* ---------- azimuths & misc ---------- */

export type Azimuth = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function azimuthDir(az: Azimuth): Vec {
  const rad = (az * Math.PI) / 4;
  return v(Math.cos(rad), Math.sin(rad));
}

/** Extent of the charge stub + symbol, for clearance checks. */
function geomChargeFar(start: Vec, dir: Vec): Vec {
  return add(start, scale(dir, CHARGE_STUB_LEN + CHARGE_SYMBOL_LEN));
}

/**
 * Pick an indicator azimuth by casting a ray from the node and requiring it
 * to clear all routed trace segments and other used nodes for the length of
 * the stub + symbol.
 */
function pickAzimuth(
  preferred: Azimuth[],
  at: { center: Vec; keepOut: number },
  usedNodes: { center: Vec; keepOut: number }[],
  segments: { a: Vec; b: Vec }[],
  symbolLen: number,
): Azimuth {
  const attachR = at.keepOut - CLEAR;
  let best = preferred[0]!;
  let bestScore = -Infinity;
  for (let i = 0; i < preferred.length; i++) {
    const az = preferred[i]!;
    const d = azimuthDir(az);
    const rayA = add(at.center, scale(d, attachR + 2));
    const rayB = add(at.center, scale(d, attachR + symbolLen + 10));
    // A segment nearly parallel to the ray would render the symbol inline
    // with a trace - far worse than a transversal crossing.
    let parClearance = Infinity;
    let anyClearance = Infinity;
    for (const s of segments) {
      const sd = norm(sub(s.b, s.a));
      const gap = segSegDistance(rayA, rayB, s.a, s.b);
      anyClearance = Math.min(anyClearance, gap);
      if (Math.abs(sd.x * d.x + sd.y * d.y) > 0.9) parClearance = Math.min(parClearance, gap);
    }
    for (const n of usedNodes) {
      if (n.center === at.center) continue;
      const gap = pointSegDist(n.center, rayA, rayB) - n.keepOut + CLEAR;
      parClearance = Math.min(parClearance, gap);
      anyClearance = Math.min(anyClearance, gap);
    }
    if (anyClearance >= 10) return az;
    // Tiered: clean parallel clearance dominates, then overall clearance,
    // then preference order.
    const score = (parClearance >= 10 ? 1000 : parClearance * 10) + Math.min(anyClearance, 9) - i * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = az;
    }
  }
  return best;
}

function segSegDistance(a1: Vec, a2: Vec, b1: Vec, b2: Vec): number {
  const d = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(
    pointSegDist(a1, b1, b2),
    pointSegDist(a2, b1, b2),
    pointSegDist(b1, a1, a2),
    pointSegDist(b2, a1, a2),
  );
}

/** Hang the null modifier just outside the corner of the glyph farthest from its nodes. */
function nullModifierPos(used: Vec[]): Vec {
  const pad = 64;
  const x1 = Math.min(...used.map((u) => u.x)) - pad;
  const x2 = Math.max(...used.map((u) => u.x)) + pad;
  const y1 = Math.min(...used.map((u) => u.y)) - pad;
  const y2 = Math.max(...used.map((u) => u.y)) + pad;
  // Tie-break toward the lower right, like the book plates.
  const cs = [v(x2, y2), v(x1, y2), v(x2, y1), v(x1, y1)];
  let best = cs[0]!;
  let bestScore = -1;
  for (const corner of cs) {
    const score = Math.min(...used.map((u) => dist(corner, u)));
    if (score > bestScore) {
      bestScore = score;
      best = corner;
    }
  }
  return best;
}

function computeBbox(g: WordGeometry): { min: Vec; max: Vec } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (p: Vec, pad = 0) => {
    minX = Math.min(minX, p.x - pad);
    minY = Math.min(minY, p.y - pad);
    maxX = Math.max(maxX, p.x + pad);
    maxY = Math.max(maxY, p.y + pad);
  };
  for (const circle of g.circles) eat(circle.center, circle.r);
  for (const t of g.traces) for (const p of t.path.pts) eat(p);
  for (const p of g.groundStub.path.pts) eat(p);
  for (const p of g.chargeStub.path.pts) eat(p);
  for (const s of g.symbols) eat(s.at, 60);
  return { min: v(minX, minY), max: v(maxX, maxY) };
}

export { len };
