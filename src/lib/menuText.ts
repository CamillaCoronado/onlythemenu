/**
 * the owner editor's plain-text format. deterministic both ways.
 *
 *   notes: entrées include rolls + soup
 *   # World Famous Steaks
 *   > tue–fri, 3–5pm
 *   Filet Mignon (GF) .... 6 oz $32.95 | 10 oz $39.95
 *     Center-cut tenderloin.
 *   Porterhouse .... MKT
 */
import type { Menu, Section } from './types';
import { formatCents } from './price';
import { normalizeItem } from '../../pipeline/normalize';

const SEP = /\s*\.{3,}\s*|\s+\t+\s*/;

export function menuToText(m: Pick<Menu, 'houseNotes' | 'sections'>): string {
  const out: string[] = [];
  if (m.houseNotes) out.push(`notes: ${m.houseNotes}`, '');
  for (const s of m.sections) {
    out.push(`# ${s.title}`);
    if (s.note) out.push(`> ${s.note}`);
    for (const it of s.items) {
      const price = it.marketPrice ? 'MKT'
        : it.variants?.length ? it.variants.map((v) => `${v.label} ${formatCents(v.priceCents)}`).join(' | ')
        : it.priceCents !== undefined ? formatCents(it.priceCents) : '';
      const tags = (it.tags ?? []).filter((t) => t !== 'spicy').map((t) => ` (${t})`).join('');
      out.push(`${it.name}${tags}${price ? ` .... ${price}` : ''}`);
      if (it.description) out.push(`  ${it.description}`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}

export type TextError = { line: number; message: string };

export function textToMenu(text: string): { houseNotes?: string; sections: Section[]; errors: TextError[] } {
  const sections: Section[] = [];
  const errors: TextError[] = [];
  let houseNotes: string | undefined;
  let cur: Section | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;
    const n = i + 1;
    if (/^notes:/i.test(line)) { houseNotes = line.replace(/^notes:\s*/i, '').trim(); return; }
    // '# ' with a space: item names like '#18 New York' stay items
    if (/^#+\s/.test(line)) { cur = { title: line.replace(/^#+\s+/, ''), items: [] }; sections.push(cur); return; }
    if (!cur) { errors.push({ line: n, message: 'start with a "# section" line' }); return; }
    if (line.startsWith('>')) { cur.note = line.replace(/^>\s*/, ''); return; }
    if (/^\s/.test(raw)) {
      const last = cur.items.at(-1);
      if (!last) errors.push({ line: n, message: 'description with no item above it' });
      else last.description = [last.description, line.trim()].filter(Boolean).join(' ');
      return;
    }
    const [name, priceText] = line.split(SEP, 2);
    const item = normalizeItem({ name, priceText });
    if (!item) { errors.push({ line: n, message: 'item needs a name' }); return; }
    if (priceText && item.priceCents === undefined && !item.variants && !item.marketPrice) {
      errors.push({ line: n, message: `can't read the price "${priceText}"` });
    }
    cur.items.push(item);
  });
  for (const s of sections) for (const it of s.items) if (it.description) it.description = normalizeItem({ name: 'x', description: it.description })!.description;
  return { ...(houseNotes && { houseNotes }), sections, errors };
}
