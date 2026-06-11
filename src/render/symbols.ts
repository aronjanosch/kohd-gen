import type { SymbolKind } from '../types';
import { STROKE } from '../layout/constants';
import { el, type SvgNode } from './svg';

/**
 * Hand-authored symbol art, traced from the campaign frame reference plates.
 * Every symbol is authored in local coordinates with the attach point at the
 * origin and its main axis pointing EAST (+x); the renderer rotates it into
 * place. Stroked shapes inherit stroke styling from the parent group.
 */

const line = (x1: number, y1: number, x2: number, y2: number): SvgNode =>
  el('line', { x1, y1, x2, y2 });

const polyline = (pts: number[][]): SvgNode =>
  el('polyline', { points: pts.map(([x, y]) => `${x},${y}`).join(' '), fill: 'none' });

const circle = (cx: number, cy: number, r: number, filled = false): SvgNode =>
  el('circle', { cx, cy, r, fill: filled ? 'currentColor' : 'none' });

/** Small arrowhead pointing along (dx,dy) with tip at (x,y). */
function arrow(x: number, y: number, dx: number, dy: number): SvgNode {
  const s = 5;
  const px = -dy;
  const py = dx;
  return polyline([
    [x - dx * s + px * s * 0.7, y - dy * s + py * s * 0.7],
    [x, y],
    [x - dx * s - px * s * 0.7, y - dy * s - py * s * 0.7],
  ]);
}

/** Charge indicator: lead line into a 3-peak resistor zigzag, short tail. */
function charge(): SvgNode[] {
  return [
    polyline([
      [0, 0],
      [10, 0],
      [14, -10],
      [20, 10],
      [26, -10],
      [32, 10],
      [38, -10],
      [42, 0],
      [54, 0],
    ]),
  ];
}

/** Ground indicator: cup opening back toward the node, then two nested bars. */
function ground(): SvgNode[] {
  return [
    polyline([
      [2, -14],
      [8, -14],
      [8, 14],
      [2, 14],
    ]),
    polyline([
      [18, -10],
      [14, -10],
      [14, 10],
      [18, 10],
    ]),
    line(20, -5, 20, 5),
  ];
}

/** Null modifier: small circle linked diagonally to a crossed circle. */
function nullModifier(): SvgNode[] {
  return [
    circle(-30, -30, 7),
    line(-25, -25, -9, -9),
    circle(0, 0, 13),
    line(-13, 0, 13, 0),
    line(0, -13, 0, 13),
  ];
}

/** Article "the": vertical bar inside the charge node circle. */
function articleThe(): SvgNode[] {
  return [line(0, -8, 0, 8)];
}

/** Article "a": plus inside the charge node circle. */
function articleA(): SvgNode[] {
  return [line(-8, 0, 8, 0), line(0, -8, 0, 8)];
}

/* ---- punctuation (keyed plate 08-58.2) ---- */

/** Period: filled dot with a short lead. */
function period(): SvgNode[] {
  return [line(0, 0, 8, 0), circle(14, 0, 4.5, true)];
}

/** Exclamation: open triangle pressed against a bar. */
function exclaim(): SvgNode[] {
  return [line(0, 0, 6, 0), polyline([[18, -7], [6, 0], [18, 7], [18, -7]]), line(22, -8, 22, 8)];
}

/** Question: a hook curling back. */
function question(): SvgNode[] {
  return [
    line(0, 0, 6, 0),
    el('path', { d: 'M6 0 A 8 8 0 1 1 20 6', fill: 'none' }),
    arrow(20, 6, 0.4, 0.9),
  ];
}

/** Comma: two short bars dividing a connector trace. */
function comma(): SvgNode[] {
  return [line(-3, -9, -3, 9), line(3, -9, 3, 9)];
}

/** Coupler: a stack of solder bars of arbitrary lengths (authored upright). */
function coupler(): SvgNode[] {
  const lengths = [22, 30, 16, 26, 34, 18, 28, 12, 24, 32, 20, 14];
  return lengths.map((w, i) => {
    const y = i * 7 - (lengths.length - 1) * 3.5;
    return el('line', { x1: -w, y1: y, x2: 0, y2: y, 'stroke-width': STROKE * 1.6 });
  });
}

/* ---- lexicon (plate 08-55), centered on the origin ---- */

function and(): SvgNode[] {
  return [
    circle(-22, -12, 4),
    circle(-22, 12, 4),
    line(-18.5, -10, -7, -3),
    line(-18.5, 10, -7, 3),
    circle(0, 0, 8),
    line(8, 0, 18, 0),
  ];
}

function or(): SvgNode[] {
  return [
    circle(-22, -12, 4),
    circle(-22, 12, 4),
    line(-18.5, -9, -7, 4),
    line(-18.5, 9, -7, -4),
    circle(0, 0, 8),
    line(8, 0, 18, 0),
  ];
}

function trueIs(): SvgNode[] {
  return [circle(-14, 0, 6), line(-8, -2.5, 8, -2.5), line(-8, 2.5, 8, 2.5), circle(14, 0, 6)];
}

function falseNot(): SvgNode[] {
  return [circle(-14, 0, 6), line(-8, 0, 8, 0), line(-2, 8, 4, -9), circle(14, 0, 6)];
}

function because(): SvgNode[] {
  return [circle(-16, 0, 4.5, true), line(-11.5, 0, 2, 0), arrow(2, 0, 1, 0), circle(10, 0, 7)];
}

function so(): SvgNode[] {
  return [circle(-10, 0, 7), line(-3, 0, 9, 0), arrow(9, 0, 1, 0), circle(16, 0, 4.5, true)];
}

function ifSym(): SvgNode[] {
  return [circle(-8, 0, 7), line(-1, 0, 14, 0), arrow(14, 0, 1, 0)];
}

function ifThen(): SvgNode[] {
  return [line(-22, 0, -8, 0), arrow(-8, 0, 1, 0), circle(0, 0, 7), line(7, 0, 22, 0), arrow(22, 0, 1, 0)];
}

function thereIs(): SvgNode[] {
  return [
    circle(0, 0, 8),
    line(-5.7, -5.7, -13, -13),
    line(5.7, -5.7, 13, -13),
    line(-5.7, 5.7, -13, 13),
    line(5.7, 5.7, 13, 13),
  ];
}

function unique(): SvgNode[] {
  return [circle(0, -3, 8), line(-4, 4, -7, 13), line(4, 4, 7, 13)];
}

function fromTo(): SvgNode[] {
  return [
    circle(-21, 0, 5),
    polyline([
      [-16, 0],
      [-9, 0],
      [-6, -9],
      [-1, 9],
      [3, -9],
      [7, 0],
      [16, 0],
    ]),
    circle(21, 0, 5),
  ];
}

function pronoun(arrows: { dy: -1 | 1; n: 1 | 2 }, dotted = false): () => SvgNode[] {
  return () => {
    const parts: SvgNode[] = [circle(0, 0, 7)];
    if (dotted) parts.push(circle(0, 0, 2, true));
    for (let i = 0; i < arrows.n; i++) {
      const x = arrows.n === 1 ? 0 : i === 0 ? -4 : 4;
      const y0 = arrows.dy * 7;
      const y1 = arrows.dy * 17;
      parts.push(line(x, y0, x, y1));
      parts.push(arrow(x, y1, 0, arrows.dy));
    }
    return parts;
  };
}

function pronounSide(n: 1 | 2, dotted = false): () => SvgNode[] {
  return () => {
    const parts: SvgNode[] = [circle(0, 0, 7)];
    if (dotted) parts.push(circle(0, 0, 2, true));
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : i === 0 ? -4 : 4;
      parts.push(line(7, y, 17, y));
      parts.push(arrow(17, y, 1, 0));
    }
    return parts;
  };
}

const FACTORIES: Record<SymbolKind, () => SvgNode[]> = {
  charge,
  ground,
  nullModifier,
  articleThe,
  articleA,
  period,
  exclaim,
  question,
  comma,
  coupler,
  and,
  or,
  true: trueIs,
  false: falseNot,
  because,
  so,
  if: ifSym,
  ifThen,
  thereIs,
  unique,
  fromTo,
  you: pronoun({ dy: -1, n: 1 }),
  iMe: pronoun({ dy: 1, n: 1 }),
  youAll: pronoun({ dy: -1, n: 2 }),
  we: pronoun({ dy: 1, n: 2 }),
  themSg: pronounSide(1),
  themPl: pronounSide(2),
  theirSg: pronounSide(1, true),
  theirPl: pronounSide(2, true),
};

export function symbolArt(kind: SymbolKind): SvgNode[] {
  return FACTORIES[kind]();
}

/** Horizontal half-extent of inline lexicon symbols, for sentence layout. */
export function lexiconHalfWidth(kind: SymbolKind): number {
  switch (kind) {
    case 'and':
    case 'or':
    case 'fromTo':
    case 'ifThen':
      return 28;
    case 'true':
    case 'false':
      return 22;
    case 'because':
    case 'so':
      return 22;
    default:
      return 18;
  }
}
