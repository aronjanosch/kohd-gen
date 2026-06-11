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

/** Open-V arrowhead pointing along (dx,dy) with tip at (x,y). */
function arrow(x: number, y: number, dx: number, dy: number): SvgNode {
  const s = 6;
  const px = -dy;
  const py = dx;
  return polyline([
    [x - dx * s + px * s * 0.65, y - dy * s + py * s * 0.65],
    [x, y],
    [x - dx * s - px * s * 0.65, y - dy * s - py * s * 0.65],
  ]);
}

/** Charge indicator: short lead into a sharp 4-peak resistor zigzag, short tail. */
function charge(): SvgNode[] {
  return [
    polyline([
      [0, 0],
      [8, 0],
      [11, -9],
      [17, 9],
      [23, -9],
      [29, 9],
      [35, -9],
      [38, 0],
      [50, 0],
    ]),
  ];
}

/**
 * Ground indicator (book plates): a tall flat bar across the lead, then a
 * bracket whose legs point away from the node, with a small tick nested
 * between the legs.
 */
function ground(): SvgNode[] {
  return [
    line(2, -15, 2, 15),
    polyline([
      [22, -11],
      [10, -11],
      [10, 11],
      [22, 11],
    ]),
    line(19, -5, 19, 5),
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
  return [line(0, -9, 0, 9)];
}

/** Article "a": plus inside the charge node circle. */
function articleA(): SvgNode[] {
  return [line(-9, 0, 9, 0), line(0, -9, 0, 9)];
}

/* ---- punctuation (keyed plate 08-58.2), affixed on the ground axis ---- */

/** Period: bar then a filled dot. */
function period(): SvgNode[] {
  return [line(2, -12, 2, 12), line(2, 0, 10, 0), circle(17, 0, 6.5, true)];
}

/** Exclamation: bar with an open triangle whose apex touches it. */
function exclaim(): SvgNode[] {
  return [line(2, -12, 2, 12), polyline([[2, 0], [16, -8], [16, 8], [2, 0]])];
}

/** Question: bar, short lead, then a hook curling back down. No arrowhead. */
function question(): SvgNode[] {
  return [
    line(2, -12, 2, 12),
    line(2, 0, 8, 0),
    el('path', { d: 'M8 0 A 7.5 7.5 0 1 1 21 5', fill: 'none' }),
  ];
}

/** Comma: two tall bars dividing a connector trace. */
function comma(): SvgNode[] {
  return [line(-4, -12, -4, 12), line(4, -12, 4, 12)];
}

/**
 * Coupler: a tall ragged stack of thick solder bars (book plates show ~25
 * bars of arbitrary length, ragged on both edges, loosely clustered).
 * Authored upright with the attach edge at x=0.
 */
function coupler(): SvgNode[] {
  const bars: [number, number][] = [
    // [width, right-edge offset]
    [34, -10], [46, -10], [28, -10], [40, -10], [52, -10], [30, -10],
    [58, 0], [36, 0], [48, 0], [26, 0], [54, 0], [42, 0], [32, 0],
    [44, -14], [24, -14], [50, -14], [38, -14], [28, -14],
    [56, -4], [34, -4], [46, -4], [26, -4], [52, -4], [38, -4],
  ];
  const step = 11;
  const y0 = -((bars.length - 1) * step) / 2;
  return bars.map(([w, off], i) =>
    el('line', {
      x1: off - w,
      y1: y0 + i * step,
      x2: off,
      y2: y0 + i * step,
      'stroke-width': STROKE * 2.4,
    }),
  );
}

/* ---- lexicon (plate 08-55), centered on the origin ---- */

/** And: two small inputs joined through elbow leads into one node, output east. */
function and(): SvgNode[] {
  return [
    circle(-31, -17, 4.5),
    polyline([[-26.5, -17], [-17, -17], [-7.2, -7.2]]),
    circle(-31, 17, 4.5),
    polyline([[-26.5, 17], [-17, 17], [-7.2, 7.2]]),
    circle(0, 0, 10),
    line(10, 0, 23, 0),
  ];
}

/** Or: like And, but the lower contact is open (broken before the node). */
function or(): SvgNode[] {
  return [
    circle(-31, -17, 4.5),
    polyline([[-26.5, -17], [-17, -17], [-7.2, -7.2]]),
    circle(-31, 17, 4.5),
    line(-26.5, 17, -20, 17),
    line(-14, 12.5, -7.2, 7.2),
    circle(0, 0, 10),
    line(10, 0, 23, 0),
  ];
}

/** True/Is: two nodes joined by two parallel bars. */
function trueIs(): SvgNode[] {
  return [circle(-18, 0, 8), line(-10, -4, 10, -4), line(-10, 4, 10, 4), circle(18, 0, 8)];
}

/** False/Not: two nodes joined by one bar, struck through. */
function falseNot(): SvgNode[] {
  return [circle(-18, 0, 8), line(-10, 0, 10, 0), line(-4, 10, 7, -11), circle(18, 0, 8)];
}

function because(): SvgNode[] {
  return [circle(-22, 0, 5, true), line(-17, 0, 0, 0), arrow(0, 0, 1, 0), circle(9, 0, 9)];
}

function so(): SvgNode[] {
  return [circle(-9, 0, 9), line(0, 0, 17, 0), arrow(17, 0, 1, 0), circle(22, 0, 5, true)];
}

function ifSym(): SvgNode[] {
  return [circle(-6, 0, 9), line(3, 0, 18, 0), arrow(18, 0, 1, 0)];
}

function ifThen(): SvgNode[] {
  return [line(-26, 0, -11, 0), arrow(-11, 0, 1, 0), circle(0, 0, 9), line(9, 0, 26, 0), arrow(26, 0, 1, 0)];
}

/** There-is: node with four splayed legs ending in horizontal caps. */
function thereIs(): SvgNode[] {
  return [
    circle(0, 0, 9),
    polyline([[-26, -16], [-16, -16], [-6.4, -6.4]]),
    polyline([[26, -16], [16, -16], [6.4, -6.4]]),
    polyline([[-26, 16], [-16, 16], [-6.4, 6.4]]),
    polyline([[26, 16], [16, 16], [6.4, 6.4]]),
  ];
}

/** Unique: node standing on two splayed legs with horizontal feet. */
function unique(): SvgNode[] {
  return [
    circle(0, -4, 9),
    polyline([[-24, 10], [-13, 10], [-6.4, 2.4]]),
    polyline([[24, 10], [13, 10], [6.4, 2.4]]),
  ];
}

/** From-to: two near-node-sized circles joined by a sharp pulse spike. */
function fromTo(): SvgNode[] {
  return [
    circle(-27, 0, 9.5),
    polyline([
      [-17.5, 0],
      [-8, 0],
      [-4.5, -12],
      [0.5, 13],
      [3.5, -7],
      [5.5, 0],
      [17.5, 0],
    ]),
    circle(27, 0, 9.5),
  ];
}

function pronoun(arrows: { dy: -1 | 1; n: 1 | 2 }, dotted = false): () => SvgNode[] {
  return () => {
    const parts: SvgNode[] = [circle(0, 0, 9)];
    if (dotted) parts.push(circle(0, 0, 3, true));
    for (let i = 0; i < arrows.n; i++) {
      const x = arrows.n === 1 ? 0 : i === 0 ? -5 : 5;
      const y0 = arrows.dy * 9;
      const y1 = arrows.dy * 23;
      parts.push(line(x, y0, x, y1));
      parts.push(arrow(x, y1, 0, arrows.dy));
    }
    return parts;
  };
}

function pronounSide(n: 1 | 2, dotted = false): () => SvgNode[] {
  return () => {
    const parts: SvgNode[] = [circle(0, 0, 9)];
    if (dotted) parts.push(circle(0, 0, 3, true));
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0 : i === 0 ? -5 : 5;
      parts.push(line(9, y, 23, y));
      parts.push(arrow(23, y, 1, 0));
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
      return 38;
    case 'fromTo':
      return 39;
    case 'ifThen':
      return 30;
    case 'true':
    case 'false':
    case 'thereIs':
      return 28;
    case 'because':
    case 'so':
      return 30;
    case 'unique':
      return 26;
    default:
      return 25;
  }
}
