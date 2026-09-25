/**
 * generic html: find text that is a price, walk up to the nearest ancestor whose siblings
 * repeat the same tag/class shape (that's an item), nearest preceding h2/h3/h4 is the section.
 */
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { Item, Section } from '../../src/lib/types';
import { collapse, isMarketPrice, normalizeItem, parsePriceToken, splitVariants, PRICE_IN_TEXT } from '../normalize';
import { AdapterError, type Adapter, type Fetched } from '../types';

const SKIP = 'script,style,noscript,template,svg,nav,header,footer,form,iframe,[aria-hidden="true"]';
const HEADING = 'h1,h2,h3,h4';

const shape = (el: Element) => `${el.tagName}.${(el.attribs.class ?? '').split(/\s+/).filter(Boolean).sort().join('.')}`;

/** a text node is a price if it is ONLY a price / variant list / market price */
function isPriceText(t: string): boolean {
  const s = collapse(t);
  if (!s || s.length > 60) return false;
  return parsePriceToken(s) !== null && /[$.]/.test(s) // bare integers only count with $ or cents
    || isMarketPrice(s)
    || splitVariants(s) !== null;
}

export function parseHtml(html: string): Section[] {
  const $ = cheerio.load(html);
  $(SKIP).remove();
  const root = $('main').first().length ? $('main').first() : $('body');

  // 1. price-bearing leaf elements
  const priceEls: Element[] = [];
  root.find('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && isPriceText($el.text())) priceEls.push(el as Element);
  });
  if (!priceEls.length) throw new AdapterError('no prices found');

  // 2. climb to the repeating item container
  const items = new Map<Element, Element[]>();
  for (const p of priceEls) {
    let cur: Element = p;
    let found: Element | null = null;
    while (cur.parent && cur.parent.type === 'tag' && cur !== root.get(0)) {
      const parent = cur.parent as Element;
      const sibs = parent.children.filter((c): c is Element => c.type === 'tag');
      const same = sibs.filter((s) => shape(s) === shape(cur));
      const text = collapse($(cur).text());
      if (same.length >= 2 && text.length > collapse($(p).text()).length) { found = cur; break; }
      cur = parent;
    }
    const it = found ?? (p.parent as Element);
    items.set(it, [...(items.get(it) ?? []), p]);
  }
  // drop containers that wrap other containers (whole-section wrappers)
  const nodes = [...items.keys()].filter((a) => ![...items.keys()].some((b) => b !== a && $(a).find(b as AnyNode).length));

  // 3. name / description / price per item, section = nearest preceding heading
  const sections: Section[] = [];
  let cur: Section | null = null;
  const all = root.find('*').toArray();
  const order = new Map(all.map((e, i) => [e, i]));
  // headings inside an item are item names, not section titles
  const headings = root.find(HEADING).toArray().filter((h) => !nodes.some((n) => $(n).find(h).length));

  for (const node of nodes.sort((a, b) => order.get(a)! - order.get(b)!)) {
    const heading = headings.filter((h) => order.get(h)! < order.get(node)! && !$(node).find(h).length).pop();
    const title = heading ? collapse($(heading).text()) : 'menu';
    if (!cur || cur.title !== title) { cur = { title, items: [] }; sections.push(cur); }

    const $n = $(node).clone();
    const priceText = items.get(node)!.map((p) => collapse($(p).text())).join(' ');
    // remove price leaves from the clone
    $n.find('*').filter((_, e) => $(e).children().length === 0 && isPriceText($(e).text())).remove();
    const nameEl = $n.find('h3,h4,h5,h6,strong,b,[class*="name"],[class*="title"]').first();
    let name = nameEl.length ? collapse(nameEl.text()) : '';
    if (nameEl.length) nameEl.remove();
    const rest = collapse($n.text().replace(PRICE_IN_TEXT, ' '));
    if (!name) { name = rest.split(/\s[–—-]\s|\.\s|:\s/)[0]; }
    const description = collapse(rest.startsWith(name) ? rest.slice(name.length) : rest).replace(/^[\s:–—-]+/, '');
    const item = normalizeItem({ name, description: description || undefined, priceText });
    if (item) cur.items.push(item);
  }
  return sections.filter((s) => s.items.length);
}

export const html: Adapter = {
  name: 'html',
  parse(doc: Fetched) {
    return { sourceType: 'html', sections: parseHtml(doc.text) };
  }
};

export type { Item };
