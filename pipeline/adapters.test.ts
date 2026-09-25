import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readSeeds } from './seedFiles';
import { ADAPTERS } from './adapters';
import { detect } from './detect';
import { normalizeMenu } from './normalize';
import { validate } from './validate';
import type { Item, Menu, Section } from '../src/lib/types';
import type { Fetched } from './types';

const FIX = join(import.meta.dirname, 'fixtures');
const seeds = Object.fromEntries(readSeeds().map((s) => [s.restaurant.slug, s.menu]));

const load = (dir: string, f: string): Fetched => {
  const body = readFileSync(join(FIX, dir, f));
  const pdf = f.endsWith('.pdf');
  return { url: `https://example.com/${f}`, contentType: pdf ? 'application/pdf' : 'text/html; charset=utf-8', body, text: pdf ? '' : body.toString('utf8') };
};

const priceSig = (it: Item) => it.marketPrice ? 'MKT' : it.variants?.length ? it.variants.map((v) => `${v.label}=${v.priceCents}`).join(',') : String(it.priceCents);
const flat = (secs: Section[]) => secs.flatMap((s) => s.items.map((it) => ({ section: s.title, ...it })));

function compare(got: Section[], want: Section[]) {
  const g = flat(got), w = flat(want);
  const byName = new Map(g.map((x) => [`${x.section}|${x.name}`, x]));
  let matched = 0, priceMismatch: string[] = [];
  for (const it of w) {
    const hit = byName.get(`${it.section}|${it.name}`);
    if (!hit) continue;
    matched++;
    if (priceSig(hit) !== priceSig(it)) priceMismatch.push(`${it.name}: ${priceSig(hit)} != ${priceSig(it)}`);
  }
  return { got: g.length, want: w.length, matched, priceMismatch };
}

const cases: [string, string, 'jsonld' | 'html' | 'pdf'][] = [];
for (const dir of ['jsonld', 'html', 'pdf'] as const)
  for (const f of readdirSync(join(FIX, dir))) cases.push([dir, f, dir]);

describe.each(cases)('%s/%s', (dir, file, type) => {
  const slug = file.split('.')[0];
  it(`detects ${type}`, () => expect(detect(load(dir, file))).toBe(type));

  it('reproduces the seed within ±2 items, exact prices', async () => {
    const parsed = await ADAPTERS[type]!.parse(load(dir, file));
    const menu = normalizeMenu({ ...parsed, sourceUrl: 'x', sourceHash: 'h', verifiedAt: '', status: 'review' } as Menu);
    const r = compare(menu.sections, seeds[slug].sections);
    if (process.env.DEBUG_FIX) console.log(file, JSON.stringify(r), flat(menu.sections).filter((x) => !flat(seeds[slug].sections).some((y) => y.name === x.name && y.section === x.section)).map((x) => `${x.section}|${x.name}`));
    expect(r.priceMismatch).toEqual([]);
    expect(Math.abs(r.got - r.want)).toBeLessThanOrEqual(2);
    expect(r.want - r.matched).toBeLessThanOrEqual(2);
    expect(menu.sections.map((s) => s.title)).toEqual(seeds[slug].sections.map((s) => s.title));
    // and it would publish straight over the seed without tripping review
    expect(validate(menu, { ...seeds[slug], sourceType: 'owner', sourceHash: '', verifiedAt: '', status: 'published' } as Menu).failures).toEqual([]);
  });

  it('matches snapshot', async () => {
    const parsed = await ADAPTERS[type]!.parse(load(dir, file));
    expect(parsed).toMatchSnapshot();
  });
});
