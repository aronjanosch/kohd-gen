import type { Vec, WordGeometry } from '../types';
import { LANE } from './constants';
import { ringRadius } from './router';
import { pointSegDist } from './router';
import { dist, dot, norm, sub } from './vec';

export interface Violation {
  rule: string;
  detail: string;
}

interface Seg {
  a: Vec;
  b: Vec;
  owner: string;
}

function segments(g: WordGeometry): Seg[] {
  const segs: Seg[] = [];
  const eat = (pts: Vec[], owner: string) => {
    for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1]!, b: pts[i]!, owner });
  };
  g.traces.forEach((t, i) => eat(t.path.pts, `trace${i}`));
  eat(g.groundStub.path.pts, 'ground');
  eat(g.chargeStub.path.pts, 'charge');
  return segs;
}

function segSegDist(s: Seg, t: Seg): number {
  if (segsIntersect(s, t)) return 0;
  return Math.min(
    pointSegDist(s.a, t.a, t.b),
    pointSegDist(s.b, t.a, t.b),
    pointSegDist(t.a, s.a, s.b),
    pointSegDist(t.b, s.a, s.b),
  );
}

function segsIntersect(s: Seg, t: Seg): boolean {
  const d = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(t.a, t.b, s.a);
  const d2 = d(t.a, t.b, s.b);
  const d3 = d(s.a, s.b, t.a);
  const d4 = d(s.a, s.b, t.b);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Length of t's projection overlapping s's extent along s's direction. */
function projectedOverlap(s: Seg, t: Seg): number {
  const d = norm(sub(s.b, s.a));
  const proj = (p: Vec) => dot(sub(p, s.a), d);
  const sEnd = proj(s.b);
  const [s1, s2] = sEnd < 0 ? [sEnd, 0] : [0, sEnd];
  const tA = proj(t.a);
  const tB = proj(t.b);
  const [t1, t2] = tA > tB ? [tB, tA] : [tA, tB];
  return Math.max(0, Math.min(s2, t2) - Math.max(s1, t1));
}

/**
 * Check the routed geometry for the failure modes of naive kohd generators:
 * traces running on top of each other, and traces cutting through node
 * circles. Transversal crossings are legal (the book has them).
 */
export function checkInvariants(g: WordGeometry): Violation[] {
  const out: Violation[] = [];
  const segs = segments(g);

  // Distinct node anchor points (one per node, ring radii merged into max).
  const anchors = new Map<number, { center: Vec; r: number }>();
  for (const c of g.circles) {
    const cur = anchors.get(c.nodeId);
    if (!cur || c.r > cur.r) anchors.set(c.nodeId, { center: c.center, r: c.r });
  }

  // Segments converging into ports of the same node legitimately come close
  // (the book plates fan bundle lines into a circle); exempt those pairs.
  const convergeAtSharedNode = (s: Seg, t: Seg): boolean => {
    for (const a of anchors.values()) {
      const reach = a.r + 18;
      const sNear = dist(s.a, a.center) < reach || dist(s.b, a.center) < reach;
      const tNear = dist(t.a, a.center) < reach || dist(t.b, a.center) < reach;
      if (sNear && tNear) return true;
    }
    return false;
  };

  // 1. No near-parallel proximity between different owners.
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const t = segs[j]!;
      if (s.owner === t.owner) continue;
      if (dist(s.a, s.b) < 6 || dist(t.a, t.b) < 6) continue; // jog stubs
      const ds = norm(sub(s.b, s.a));
      const dt = norm(sub(t.b, t.a));
      const cos = Math.abs(dot(ds, dt));
      if (cos < Math.cos((15 * Math.PI) / 180)) continue;
      const overlap = projectedOverlap(s, t);
      if (overlap < 12) continue;
      const gap = segSegDist(s, t);
      if (gap < LANE - 2.5 && !convergeAtSharedNode(s, t)) {
        out.push({
          rule: 'parallel-overlap',
          detail: `${s.owner} and ${t.owner} run ${gap.toFixed(1)} apart over ${overlap.toFixed(0)} units`,
        });
      }
    }
  }

  // 2. Traces keep out of node circles they don't terminate at.
  for (const t of g.traces) {
    const ends = new Set([t.spec.from.node, t.spec.to.node]);
    for (const c of g.circles) {
      if (ends.has(c.nodeId)) continue;
      const r = ringRadius(c.ring);
      for (let i = 1; i < t.path.pts.length; i++) {
        const d = pointSegDist(c.center, t.path.pts[i - 1]!, t.path.pts[i]!);
        if (d < r + 2) {
          out.push({
            rule: 'keep-out',
            detail: `trace${t.spec.seq} passes ${d.toFixed(1)} from node ${c.nodeId} (r=${r})`,
          });
        }
      }
    }
  }

  // 3. Dots sit on their trace path.
  const onPath = (dotsOwner: string, pts: Vec[], dots: { center: Vec }[]) => {
    for (const d of dots) {
      let min = Infinity;
      for (let i = 1; i < pts.length; i++) min = Math.min(min, pointSegDist(d.center, pts[i - 1]!, pts[i]!));
      if (min > 1) out.push({ rule: 'dot-off-path', detail: `${dotsOwner} dot ${min.toFixed(1)} off path` });
    }
  };
  for (const t of g.traces) onPath(`trace${t.spec.seq}`, t.path.pts, t.dots);
  onPath('ground', g.groundStub.path.pts, g.groundStub.dots);

  return out;
}
