/** deterministic text -> Menu normalization. no LLM, no network. */
import type { Item, Menu, Section, Tag, Variant } from '../src/lib/types';

/** from the brief. use parsePriceToken for whole-token parsing. */
export const PRICE_RE = /\$?\s?(\d{1,3}(?:,\d{3})*)(?:\.(\d{2}))?\b/;
/** a price-looking token inside running text: needs a $ or cents, so "6 oz" / "12 pc" never match */
export const PRICE_IN_TEXT = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|(?<![\w.$])\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
const MARKET = /^(?:market(?:\s+price)?|mp|mkt|m\.p\.|a\.?q\.?)$/i;

export const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** "$32.95" | "32.95" | "32" | "1,200" -> cents. the whole token must be a price. */
export function parsePriceToken(s: string): number | null {
  const t = collapse(s).replace(/^\$\s?/, '$');
  const m = t.match(new RegExp(`^${PRICE_RE.source}$`));
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10) * 100 + (m[2] ? parseInt(m[2], 10) : 0);
}

export const isMarketPrice = (s: string) => MARKET.test(collapse(s).replace(/[()]/g, ''));

/** "SM $3.25, LG $3.75" | "6 oz $32.95 | 10 oz $39.95" | "Single 14.99 Double 19.49" */
export function splitVariants(text: string): Variant[] | null {
  const t = collapse(text);
  const hits = [...t.matchAll(PRICE_IN_TEXT)];
  if (hits.length < 2) return null;
  const out: Variant[] = [];
  let prev = 0;
  for (const h of hits) {
    const label = t.slice(prev, h.index).replace(/^[\s,|/·;:–—-]+|[\s,|/·;:–—-]+$/g, '').trim();
    const cents = parsePriceToken(h[0]);
    if (!label || cents === null || label.length > 30) return null;
    out.push({ label, priceCents: cents });
    prev = h.index! + h[0].length;
  }
  // trailing text after the last price means this wasn't a clean variant string
  if (t.slice(prev).replace(/[\s,|/·;.]+/g, '')) return null;
  return out;
}

export function trimDescription(s: string, max = 160): string {
  const t = collapse(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:–—-]+$/, '')}…`;
}

export function tagsFrom(text: string): Tag[] {
  const t = ` ${text.toLowerCase()} `;
  const tags = new Set<Tag>();
  if (/\bvegan\b|\(vg\)/.test(t)) tags.add('VG');
  else if (/\bvegetarian\b|\(v\)/.test(t)) tags.add('V');
  if (/gluten[\s-]free|\(gf\)|\bgf\b/.test(t)) tags.add('GF');
  // 'spicy' is only set by owners/json-ld: inferring it from names ('spicy sirloin') is too noisy
  return [...tags];
}

/** strip the markers tagsFrom() reads so they don't clutter names */
export const stripTagMarkers = (s: string) => collapse(s.replace(/\((?:v|vg|gf)\)/gi, ''));

export type RawItem = { name: string; description?: string; priceText?: string };

export function normalizeItem(raw: RawItem): Item | null {
  const name = stripTagMarkers(raw.name).replace(/[\s.…·:–—-]+$/, '');
  if (!name) return null;
  const item: Item = { name };
  const desc = raw.description ? collapse(raw.description) : '';
  const p = raw.priceText ? collapse(raw.priceText) : '';

  if (p) {
    if (isMarketPrice(p)) item.marketPrice = true;
    else {
      const single = parsePriceToken(p);
      if (single !== null) item.priceCents = single;
      else {
        const v = splitVariants(p);
        if (v) item.variants = v;
      }
    }
  }
  if (desc) item.description = trimDescription(stripTagMarkers(desc));
  const tags = tagsFrom(`${raw.name} ${desc}`);
  if (tags.length) item.tags = tags;
  return item;
}

export function normalizeMenu(m: Menu): Menu {
  const sections: Section[] = m.sections
    .map((s) => ({
      title: collapse(s.title),
      ...(s.note && { note: collapse(s.note) }),
      items: s.items.map((it) => ({
        ...it,
        name: collapse(it.name),
        ...(it.description && { description: trimDescription(it.description) }),
        ...(it.tags && { tags: [...new Set(it.tags)] })
      }))
    }))
    .filter((s) => s.title || s.items.length);
  return { ...m, ...(m.houseNotes && { houseNotes: collapse(m.houseNotes) }), sections };
}
