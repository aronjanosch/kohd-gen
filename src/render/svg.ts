/** Minimal string-based SVG tree — testable in node without a DOM. */

export interface SvgNode {
  tag: string;
  attrs: Record<string, string | number>;
  children?: SvgNode[];
}

export function el(tag: string, attrs: Record<string, string | number> = {}, children: SvgNode[] = []): SvgNode {
  return { tag, attrs, children };
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function serialize(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
  const kids = node.children ?? [];
  if (kids.length === 0) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${kids.map(serialize).join('')}</${node.tag}>`;
}

/** Round to 2 decimals to keep SVG output stable and compact. */
export function fmt(n: number): number {
  return Math.round(n * 100) / 100;
}
