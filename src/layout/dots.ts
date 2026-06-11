import type { Dot, DotGroup, Polyline, Vec } from '../types';
import { DOT_R, DOT_SPACING, GROUP_GAP } from './constants';
import { dist, lerp } from './vec';

export function polylineLength(p: Polyline): number {
  let total = 0;
  for (let i = 1; i < p.pts.length; i++) total += dist(p.pts[i - 1]!, p.pts[i]!);
  return total;
}

/** Point at arc length s along the polyline (clamped to the ends). */
export function pointAt(p: Polyline, s: number): Vec {
  if (p.pts.length === 1) return p.pts[0]!;
  let remaining = Math.max(0, s);
  for (let i = 1; i < p.pts.length; i++) {
    const a = p.pts[i - 1]!;
    const b = p.pts[i]!;
    const seg = dist(a, b);
    if (remaining <= seg || i === p.pts.length - 1) {
      return lerp(a, b, seg === 0 ? 0 : Math.min(1, remaining / seg));
    }
    remaining -= seg;
  }
  return p.pts[p.pts.length - 1]!;
}

/** Total arc length a run of dot groups needs. */
export function dotRunLength(groups: DotGroup[]): number {
  if (groups.length === 0) return 0;
  const dots = groups.reduce((n, g) => n + g.count, 0);
  return (dots - groups.length) * DOT_SPACING + (groups.length - 1) * GROUP_GAP;
}

/**
 * Place dot groups along a path, starting at arc length `startAt`.
 * If the path is too short the spacing compresses to fit (the router is
 * expected to make this rare).
 */
export function placeDots(path: Polyline, groups: DotGroup[], startAt: number, endPad: number): Dot[] {
  if (groups.length === 0) return [];
  const total = polylineLength(path);
  const available = total - startAt - endPad;
  const needed = dotRunLength(groups);
  const squeeze = needed > 0 && available < needed ? Math.max(0.4, available / needed) : 1;

  const dots: Dot[] = [];
  let s = startAt;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      dots.push({ center: pointAt(path, s), r: DOT_R });
      if (i < g.count - 1) s += DOT_SPACING * squeeze;
    }
    s += GROUP_GAP * squeeze;
  }
  return dots;
}
