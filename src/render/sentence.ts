import type { SentenceGeometry } from '../compose/sentence';
import { STROKE } from '../layout/constants';
import { add, perp, scale } from '../layout/vec';
import type { Polyline } from '../types';
import { el, fmt, serialize, type SvgNode } from './svg';
import { symbolArt } from './symbols';
import { wordGroup } from './word';

function pathD(p: Polyline): string {
  return p.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${fmt(pt.x)} ${fmt(pt.y)}`).join('');
}

export function sentenceGroup(s: SentenceGeometry): SvgNode {
  const children: SvgNode[] = [];

  for (const conn of s.connectors) {
    children.push(el('path', { d: pathD(conn.path), fill: 'none' }));
    for (const bar of conn.bars) {
      const p = perp(bar.dir);
      const a = add(bar.at, scale(p, 8));
      const b = add(bar.at, scale(p, -8));
      children.push(el('line', { x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) }));
    }
    if (conn.comma) {
      const deg = (Math.atan2(conn.comma.dir.y, conn.comma.dir.x) * 180) / Math.PI;
      children.push(
        el(
          'g',
          { transform: `translate(${fmt(conn.comma.at.x)} ${fmt(conn.comma.at.y)}) rotate(${fmt(deg)})` },
          symbolArt('comma'),
        ),
      );
    }
  }

  for (const w of s.words) {
    children.push(
      el('g', { transform: `translate(${fmt(w.offset.x)} ${fmt(w.offset.y)})` }, [wordGroup(w.geom)]),
    );
  }

  for (const sym of s.symbols) {
    children.push(
      el(
        'g',
        { transform: `translate(${fmt(sym.at.x)} ${fmt(sym.at.y)}) rotate(${fmt(sym.rotation)})` },
        symbolArt(sym.kind),
      ),
    );
  }

  return el('g', {}, children);
}

export function sentenceSvg(s: SentenceGeometry, pad = 16): string {
  const min = { x: s.bbox.min.x - pad, y: s.bbox.min.y - pad };
  const w = s.bbox.max.x - s.bbox.min.x + 2 * pad;
  const h = s.bbox.max.y - s.bbox.min.y + 2 * pad;
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
    [sentenceGroup(s)],
  );
  return serialize(root);
}
