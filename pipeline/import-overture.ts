/**
 * Overture Places -> restaurants/{citySlug--slug}. upsert by overtureId; fills geo on seeded rows (name + street number).
 *   npx tsx pipeline/import-overture.ts --release 2026-09-17.0 [--dry]
 * release names: https://docs.overturemaps.org/release/latest/ (pass it explicitly; paths change per release)
 */
import { DuckDBInstance } from '@duckdb/node-api';
import type { Restaurant } from '../src/lib/types';
import { db, firebaseEnabled } from './firebase';
import { buildSearchIndex } from './build-search-index';

// launch metro: Box Elder + Cache counties, UT (bbox union; the ID border at 42.0 is filtered by region below)
const BBOX = { xmin: -114.05, xmax: -111.40, ymin: 41.0, ymax: 42.0 };
const MIN_CONFIDENCE = 0.7;
const FOOD = ['cafe', 'coffee_shop', 'diner', 'bakery', 'ice_cream_shop', 'sandwich_shop', 'food_truck', 'deli',
  'bagel_shop', 'donut_shop', 'juice_bar', 'dessert_shop', 'pizza_place', 'fast_food_restaurant', 'food_stand', 'bar_and_grill_restaurant'];

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Row = { id: string; name: string; category: string; confidence: number; street: string | null; locality: string | null;
  region: string | null; postcode: string | null; phone: string | null; website: string | null; lat: number; lng: number; datasets: string | null };

async function query(release: string): Promise<Row[]> {
  const duck = await DuckDBInstance.create(':memory:');
  const c = await duck.connect();
  await c.run(`INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';`);
  const food = FOOD.map((f) => `'${f}'`).join(',');
  const res = await c.runAndReadAll(`
    SELECT id, names.primary AS name, categories.primary AS category, confidence,
      addresses[1].freeform AS street, addresses[1].locality AS locality, addresses[1].region AS region, addresses[1].postcode AS postcode,
      phones[1] AS phone, websites[1] AS website, ST_Y(geometry) AS lat, ST_X(geometry) AS lng,
      array_to_string(list_transform(sources, s -> s.dataset), ',') AS datasets
    FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning=1)
    WHERE bbox.xmin BETWEEN ${BBOX.xmin} AND ${BBOX.xmax} AND bbox.ymin BETWEEN ${BBOX.ymin} AND ${BBOX.ymax}
      AND confidence >= ${MIN_CONFIDENCE}
      AND (categories.primary LIKE '%restaurant%' OR categories.primary IN (${food}))
      AND coalesce(addresses[1].region, 'UT') IN ('UT', 'US-UT')`);
  return res.getRowObjectsJS() as unknown as Row[];
}

const streetNo = (s?: string | null) => s?.match(/^\d+/)?.[0] ?? '';
const norm = (s: string) => slugify(s).replace(/-(restaurant|cafe|the)-?/g, '-');

export function toRestaurant(r: Row): Omit<Restaurant, 'id'> & { sources: string[] } {
  const citySlug = `${slugify(r.locality ?? 'unknown')}-ut`;
  return {
    slug: slugify(r.name), citySlug, name: r.name,
    address: [r.street, r.locality && `${r.locality}, UT${r.postcode ? ` ${r.postcode.slice(0, 5)}` : ''}`].filter(Boolean).join(', '),
    ...(r.phone && { phone: r.phone.replace(/^\+1\s?/, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') }),
    ...(r.website && { website: r.website }),
    geo: { lat: r.lat, lng: r.lng }, cuisine: [r.category.replace(/_restaurant$/, '').replace(/_/g, ' ')],
    overtureId: r.id, hasMenu: false,
    // keep provenance for /about attribution (foursquare rows are apache 2.0)
    sources: (r.datasets ?? '').split(',').filter(Boolean)
  };
}

async function main() {
  const args = process.argv.slice(2);
  const release = args[args.indexOf('--release') + 1];
  if (!release || args.indexOf('--release') < 0) throw new Error('pass --release <overture release, e.g. 2026-09-17.0>');
  const dry = args.includes('--dry') || !firebaseEnabled;

  const rows = await query(release);
  console.log(`${rows.length} places from overture ${release}`);
  if (dry) { for (const r of rows.slice(0, 20)) console.log(toRestaurant(r)); return; }

  const existing = (await db().collection('restaurants').get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Restaurant);
  const byOverture = new Map(existing.filter((r) => r.overtureId).map((r) => [r.overtureId!, r]));
  const taken = new Set(existing.map((r) => r.id));
  let created = 0, updated = 0, geoFilled = 0;
  let batch = db().batch(), n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = db().batch(); n = 0; } };

  for (const row of rows) {
    const next = toRestaurant(row);
    const hit = byOverture.get(row.id)
      // seeded rows have geo: null and no overtureId: match on name + street number
      ?? existing.find((r) => !r.overtureId && norm(r.name) === norm(next.name) && streetNo(r.address) === streetNo(next.address));
    if (hit) {
      // never clobber owner/seed-curated fields; just attach overture id + geo + fill blanks
      batch.set(db().collection('restaurants').doc(hit.id), {
        overtureId: row.id, geo: hit.geo ?? next.geo, sources: next.sources,
        ...(!hit.phone && next.phone && { phone: next.phone }), ...(!hit.website && next.website && { website: next.website })
      }, { merge: true });
      if (!hit.geo) geoFilled++;
      updated++;
    } else {
      let id = `${next.citySlug}--${next.slug}`;
      if (taken.has(id)) { next.slug = `${next.slug}-${streetNo(row.street) || row.id.slice(0, 6)}`; id = `${next.citySlug}--${next.slug}`; }
      taken.add(id);
      batch.set(db().collection('restaurants').doc(id), next);
      created++;
    }
    if (++n === 400) await flush();
  }
  await flush();
  console.log({ created, updated, geoFilled });
  await buildSearchIndex();
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
