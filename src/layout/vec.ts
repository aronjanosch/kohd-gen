import type { Vec } from '../types';

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => v(a.x + b.x, a.y + b.y);
export const sub = (a: Vec, b: Vec): Vec => v(a.x - b.x, a.y - b.y);
export const scale = (a: Vec, s: number): Vec => v(a.x * s, a.y * s);
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const dist = (a: Vec, b: Vec): number => len(sub(a, b));
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l === 0 ? v(0, 0) : scale(a, 1 / l);
};
/** Perpendicular (rotated +90deg in screen coords: x right, y down). */
export const perp = (a: Vec): Vec => v(-a.y, a.x);
export const lerp = (a: Vec, b: Vec, t: number): Vec => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
