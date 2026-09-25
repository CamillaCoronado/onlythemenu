/**
 * shared by pdf + image adapters. tokens with position + size -> lines -> sections.
 * a line's right-most price token is its price; bigger text without a price is a section title.
 */
import type { Section } from '../../src/lib/types';
import { collapse, normalizeItem, parsePriceToken, isMarketPrice, splitVariants } from '../normalize';

export type Token = { text: string; x: number; y: number; w: number; size: number };
export type Line = { tokens: Token[]; y: number; size: number; text: string };

/** y grows downward. tokens within half a line-height share a line. */
export function groupLines(tokens: Token[]): Line[] {
  const sorted = tokens.filter((t) => t.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const t of sorted) {
    const l = lines.find((l) => Math.abs(l.y - t.y) < Math.max(l.size, t.size) * 0.5);
    if (l) { l.tokens.push(t); l.size = Math.max(l.size, t.size); }
    else lines.push({ tokens: [t], y: t.y, size: t.size, text: '' });
  }
  for (const l of lines) {
    l.tokens.sort((a, b) => a.x - b.x);
    l.text = collapse(l.tokens.map((t) => t.text).join(' '));
  }
  return lines.sort((a, b) => a.y - b.y);
}

/** a whole token that is a price, market price, or a variant list ("SM $3.25  LG $3.75") */
const priceish = (s: string) => {
  const t = s.replace(/^\.+/, '');
  return (parsePriceToken(t) !== null && /[$.]/.test(t)) || isMarketPrice(t) || splitVariants(t) !== null;
};

function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; }

export function linesToSections(lines: Line[]): Section[] {
  const body = median(lines.map((l) => l.size));
  const sections: Section[] = [];
  let cur: Section | null = null;
  let last: ReturnType<typeof normalizeItem> = null;

  for (const l of lines) {
    // right-most tokens that are prices (also catches "SM 3.25 LG 3.75")
    const toks = l.tokens.map((t) => collapse(t.text.replace(/\.{2,}|…+/g, ' '))).filter(Boolean);
    let cut = toks.length;
    while (cut > 0 && priceish(toks[cut - 1])) cut--;
    const hasPrice = cut < toks.length;

    if (!hasPrice && l.size > body * 1.2) {
      cur = { title: l.text, items: [] }; sections.push(cur); last = null; continue;
    }
    if (!cur) { cur = { title: 'menu', items: [] }; sections.push(cur); }

    if (hasPrice) {
      const item = normalizeItem({ name: toks.slice(0, cut).join(' '), priceText: toks.slice(cut).join(' ') });
      if (item) { cur.items.push(item); last = item; }
    } else if (last && !last.description) {
      last.description = collapse(l.text).slice(0, 160); // first plain line under an item describes it
    } else if (!cur.items.length) {
      cur.note = collapse(`${cur.note ?? ''} ${l.text}`);
    }
  }
  return sections.filter((s) => s.items.length);
}
