/** schema.org Menu in <script type="application/ld+json"> -> Menu. direct field mapping. */
import * as cheerio from 'cheerio';
import type { Item, Section, Tag } from '../../src/lib/types';
import { collapse, isMarketPrice, normalizeItem, parsePriceToken } from '../normalize';
import { AdapterError, type Adapter, type Fetched } from '../types';

type J = Record<string, any>;
const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const isType = (o: J, t: string) => arr(o?.['@type']).some((x: string) => x === t || x.endsWith(`/${t}`));

const DIETS: Record<string, Tag> = { VeganDiet: 'VG', VegetarianDiet: 'V', GlutenFreeDiet: 'GF' };

export function findMenus(node: unknown, out: J[] = []): J[] {
  if (Array.isArray(node)) node.forEach((n) => findMenus(n, out));
  else if (node && typeof node === 'object') {
    const o = node as J;
    if (isType(o, 'Menu')) out.push(o);
    else for (const k of ['@graph', 'hasMenu', 'menu', 'mainEntity']) if (o[k]) findMenus(o[k], out);
  }
  return out;
}

export function jsonLdBlocks(html: string): unknown[] {
  const $ = cheerio.load(html);
  return $('script[type="application/ld+json"]').toArray().flatMap((el) => {
    try { return [JSON.parse($(el).text())]; } catch { return []; }
  });
}

function offerCents(o: J): number | null {
  if (o == null) return null;
  const p = o.price ?? o.lowPrice ?? o.priceSpecification?.price;
  if (typeof p === 'number') return Math.round(p * 100);
  return typeof p === 'string' ? parsePriceToken(p) : null;
}

function mapItem(mi: J): Item | null {
  const item = normalizeItem({ name: String(mi.name ?? ''), description: mi.description ? String(mi.description) : undefined });
  if (!item) return null;
  const offers = arr<J>(mi.offers);
  if (offers.length === 1 && typeof offers[0].price === 'string' && isMarketPrice(offers[0].price)) item.marketPrice = true;
  else if (offers.length === 1 && offerCents(offers[0]) !== null) item.priceCents = offerCents(offers[0])!;
  else if (offers.length > 1) {
    item.variants = offers.flatMap((o, i) => {
      const c = offerCents(o);
      return c === null ? [] : [{ label: collapse(String(o.name ?? o.eligibleQuantity?.value ?? `option ${i + 1}`)), priceCents: c }];
    });
    if (!item.variants.length) delete item.variants;
  }
  const diets = arr<string>(mi.suitableForDiet).map((d) => DIETS[String(d).split('/').pop()!]).filter(Boolean);
  if (diets.length) item.tags = [...new Set([...(item.tags ?? []), ...diets])];
  return item;
}

function mapSections(sec: J, prefix = ''): Section[] {
  const title = collapse([prefix, String(sec.name ?? '')].filter(Boolean).join(' — '));
  const items = arr<J>(sec.hasMenuItem).map(mapItem).filter((x): x is Item => !!x);
  const own: Section[] = items.length ? [{ title: title || 'menu', ...(sec.description && { note: collapse(String(sec.description)) }), items }] : [];
  return [...own, ...arr<J>(sec.hasMenuSection).flatMap((s) => mapSections(s, title))];
}

export const jsonld: Adapter = {
  name: 'jsonld',
  parse(doc: Fetched) {
    const menus = jsonLdBlocks(doc.text).flatMap((b) => findMenus(b));
    if (!menus.length) throw new AdapterError('no schema.org Menu found');
    const sections = menus.flatMap((m) => [
      ...mapSections({ name: '', hasMenuItem: m.hasMenuItem }),
      ...arr<J>(m.hasMenuSection).flatMap((s) => mapSections(s))
    ]);
    const note = menus[0].description ? collapse(String(menus[0].description)) : undefined;
    return { sourceType: 'jsonld', sections, ...(note && { houseNotes: note }) };
  }
};
