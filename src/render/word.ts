import type { Polyline, WordGeometry } from '../types';
import { DOT_R, STROKE } from '../layout/constants';
import { el, fmt, serialize, type SvgNode } from './svg';
import { symbolArt } from './symbols';

function pathD(p: Polyline): string {
  return p.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${fmt(pt.x)} ${fmt(pt.y)}`).join('');
}

/** Render routed word geometry into an SVG <g> subtree. */
export function wordGroup(g: WordGeometry): SvgNode {
  const children: SvgNode[] = [];

  for (const t of g.traces) {
    children.push(el('path', { d: pathD(t.path), fill: 'none' }));
  }
  children.push(el('path', { d: pathD(g.chargeStub.path), fill: 'none' }));
  children.push(el('path', { d: pathD(g.groundStub.path), fill: 'none' }));

  for (const c of g.circles) {
    children.push(el('circle', { cx: fmt(c.center.x), cy: fmt(c.center.y), r: fmt(c.r), fill: 'none' }));
  }

  for (const t of g.traces) {
    for (const d of t.dots) {
      children.push(el('circle', { cx: fmt(d.center.x), cy: fmt(d.center.y), r: d.r, fill: 'currentColor', stroke: 'none' }));
    }
  }
  for (const d of g.groundStub.dots) {
    children.push(el('circle', { cx: fmt(d.center.x), cy: fmt(d.center.y), r: d.r, fill: 'currentColor', stroke: 'none' }));
  }

  for (const s of g.symbols) {
    children.push(
      el(
        'g',
        { transform: `translate(${fmt(s.at.x)} ${fmt(s.at.y)}) rotate(${fmt(s.rotation)})` },
        symbolArt(s.kind),
      ),
    );
  }

  return el('g', {}, children);
}

/** Render a single word as a complete standalone SVG document string. */
export function wordSvg(g: WordGeometry, pad = 12): string {
  const min = { x: g.bbox.min.x - pad, y: g.bbox.min.y - pad };
  const w = g.bbox.max.x - g.bbox.min.x + 2 * pad;
  const h = g.bbox.max.y - g.bbox.min.y + 2 * pad;
  const root = el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `${fmt(min.x)} ${fmt(min.y)} ${fmt(w)} ${fmt(h)}`,
      stroke: 'currentColor',
      'stroke-width': STROKE,
      'stroke-linecap': 'square',
      'stroke-linejoin': 'miter',
      color: '#1a1a1a',
    },
    [wordGroup(g)],
  );
  return serialize(root);
}

export { DOT_R };
