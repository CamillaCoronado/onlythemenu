/**
 * overture gives a restaurant's homepage, but the pipeline needs the page the menu is actually on.
 * follow each homepage once, pick its best menu link, and write sources/{id}.
 *   npx tsx pipeline/find-menus.ts [--limit 50] [--dry]
 */
import * as cheerio from 'cheerio';
import { politeFetch, RobotsDenied } from './fetch';
import { getSource, getStoredIndex, patchSource, storeEnabled } from '../src/lib/server/store';

/** a link is a menu link if its url or its text says so; "menus" and "our menu" included */
const MENU_RE = /\bmenus?\b|\bfood\b|\bdrinks?\b|\bbreakfast\b|\blunch\b|\bdinner\b/i;
/** ordering platforms and socials are not a menu page we can parse */
const OFFSITE = /toasttab|chownow|clover|square\.site|squareup|doordash|ubereats|grubhub|facebook|instagram|yelp|opentable|linktr/i;

/** words too generic to identify a restaurant by */
const GENERIC = new Set(['the', 'a', 'and', 'of', 'restaurant', 'cafe', 'caf', 'grill', 'grille', 'bar', 'kitchen',
  'bistro', 'diner', 'house', 'pizza', 'pizzeria', 'bakery', 'coffee', 'shop', 'co', 'inc', 'llc', 'drive', 'in',
  'food', 'foods', 'eatery', 'deli', 'market', 'company', 'bakehouse', 'creamery', 'steakhouse', 'tavern', 'pub']);

/**
 * overture's website field is often wrong — a school district for a school cafeteria, a corporate parent, a
 * different location of the same brand. if no distinctive word from the name is anywhere on the page, it is
 * not this restaurant's site and its menu would be published against the wrong place.
 */
export function nameAppears(name: string, html: string): boolean {
  const tokens = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((t) => t.length > 2 && !GENERIC.has(t));
  if (!tokens.length) return true; // nothing distinctive to check against
  const text = html.toLowerCase().replace(/<[^>]+>/g, ' ');
  return tokens.some((t) => text.includes(t));
}

export function pickMenuUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const scored: { url: string; score: number }[] = [];

  $('a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    const text = ($(a).text() || '').trim();
    let u: URL;
    try { u = new URL(href, baseUrl); } catch { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname !== base.hostname) return;
    if (OFFSITE.test(u.href)) return;

    const path = u.pathname.toLowerCase();
    const inText = MENU_RE.test(text);
    const inPath = MENU_RE.test(path);
    if (!inText && !inPath) return;

    // prefer a path that is about the menu over a word that merely appears in the link text
    let score = (inPath ? 2 : 0) + (inText ? 1 : 0);
    if (/^\/(menus?|our-menu|food)\/?$/.test(path)) score += 4;
    if (/\.(pdf)$/i.test(path)) score += 1;
    if (/gift|card|catering|event|cater/i.test(path + text)) score -= 3;
    scored.push({ url: u.href.split('#')[0], score });
  });

  scored.sort((a, b) => b.score - a.score || a.url.length - b.url.length);
  return scored[0]?.score > 0 ? scored[0].url : null;
}

async function main() {
  if (!storeEnabled) throw new Error('needs a blob store (BLOB_READ_WRITE_TOKEN)');
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;

  const rows = (await getStoredIndex(true)).filter((r) => r.website && !r.hasMenu);
  let found = 0, none = 0, failed = 0, skipped = 0, mismatched = 0, n = 0;

  for (const r of rows) {
    if (n >= limit) break;
    if (await getSource(r.id)) { skipped++; continue; }
    n++;
    try {
      const home = await politeFetch(r.website!);
      if (!home.text || !nameAppears(r.name, home.text)) {
        mismatched++;
        console.log(`notours ${r.id}  ${r.website} never mentions "${r.name}"`);
        continue;
      }
      const menu = home.text ? pickMenuUrl(home.text, home.url) : null;
      if (!menu) { none++; console.log(`none    ${r.id}  (${r.website})`); continue; }
      found++;
      console.log(`found   ${r.id}  ${menu}`);
      if (!dry) await patchSource(r.id, { url: menu, pinned: false, failCount: 0 });
    } catch (e) {
      failed++;
      console.log(`failed  ${r.id}  ${e instanceof RobotsDenied ? 'robots denied' : String((e as Error).message).slice(0, 50)}`);
    }
  }
  console.log({ found, none, mismatched, failed, skipped, considered: rows.length });
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
