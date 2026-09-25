/**
 * search indexes are ISR routes (/search/{city}.json, /search/cities.json), so "rebuild" = revalidate them.
 *   npx tsx pipeline/build-search-index.ts [citySlug ...]          # revalidate on the live site
 *   npx tsx pipeline/build-search-index.ts --out pipeline/.cache     # also dump locally for inspection
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCities, buildCityIndex } from '../src/lib/server/searchIndex';
import type { Restaurant } from '../src/lib/types';
import { db, firebaseEnabled } from './firebase';
import { getStoredIndex, storeEnabled } from '../src/lib/server/store';
import { readSeeds } from './seedFiles';
import { revalidate } from './revalidate';

async function allRestaurants(): Promise<Restaurant[]> {
  if (storeEnabled) return getStoredIndex(true);
  if (!firebaseEnabled) return readSeeds().map((s) => s.restaurant);
  const snap = await db().collection('restaurants').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant);
}

export async function buildSearchIndex(only?: string[], out?: string) {
  const cities = only?.length ? only : [...new Set((await allRestaurants()).map((r) => r.citySlug))];
  if (out) {
    const rows = await allRestaurants();
    mkdirSync(out, { recursive: true });
    for (const c of cities) writeFileSync(join(out, `${c}.json`), buildCityIndex(rows.filter((r) => r.citySlug === c)));
    writeFileSync(join(out, 'cities.json'), JSON.stringify(buildCities(rows)));
  }
  await revalidate([...cities.map((c) => `/search/${c}.json`), '/search/cities.json']);
  console.log(`reindexed ${cities.join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const o = args.indexOf('--out');
  const out = o >= 0 ? args.splice(o, 2)[1] : undefined;
  buildSearchIndex(args, out).catch((e) => { console.error(e); process.exit(1); });
}
