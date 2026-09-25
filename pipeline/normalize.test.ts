import { describe, expect, it } from 'vitest';
import { isMarketPrice, normalizeItem, parsePriceToken, splitVariants, tagsFrom, trimDescription } from './normalize';
import { validate } from './validate';
import type { Menu } from '../src/lib/types';

describe('prices', () => {
  it('parses tokens to integer cents', () => {
    expect(parsePriceToken('$32.95')).toBe(3295);
    expect(parsePriceToken('32.95')).toBe(3295);
    expect(parsePriceToken('$ 4')).toBe(400);
    expect(parsePriceToken('1,250.00')).toBe(125000);
    expect(parsePriceToken('12 oz')).toBeNull();
  });
  it('splits the three brief variant patterns', () => {
    expect(splitVariants('SM $3.25, LG $3.75')).toEqual([{ label: 'SM', priceCents: 325 }, { label: 'LG', priceCents: 375 }]);
    expect(splitVariants('6 oz $32.95 | 10 oz $39.95')).toEqual([{ label: '6 oz', priceCents: 3295 }, { label: '10 oz', priceCents: 3995 }]);
    expect(splitVariants('Single 14.99 Double 19.49')).toEqual([{ label: 'Single', priceCents: 1499 }, { label: 'Double', priceCents: 1949 }]);
    expect(splitVariants('$9.99')).toBeNull();
    expect(splitVariants('6 oz $32.95 with fries $3.00 extra')).toBeNull();
  });
  it('market price', () => {
    for (const s of ['Market Price', 'MP', 'MKT', '(market)']) expect(isMarketPrice(s)).toBe(true);
    expect(normalizeItem({ name: 'Porterhouse', priceText: 'MKT' })).toEqual({ name: 'Porterhouse', marketPrice: true });
  });
});

describe('text', () => {
  it('trims descriptions to 160 on a word boundary', () => {
    const long = 'word '.repeat(60);
    const t = trimDescription(long);
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t.endsWith('word…')).toBe(true);
  });
  it('tags', () => {
    expect(tagsFrom('Vegan chili (GF)')).toEqual(['VG', 'GF']);
    expect(tagsFrom('Veggie Burger (V)')).toEqual(['V']);
    expect(tagsFrom('gluten-free bun')).toEqual(['GF']);
    expect(tagsFrom('Spicy Sirloin')).toEqual([]);
  });
  it('keeps casing, collapses whitespace, strips tag markers', () => {
    expect(normalizeItem({ name: '  Veggie   Burger (V) ', priceText: '$10.95' })).toEqual({ name: 'Veggie Burger', priceCents: 1095, tags: ['V'] });
  });
});

describe('validate', () => {
  const base: Menu = {
    sourceUrl: 'x', sourceType: 'html', sourceHash: 'h', verifiedAt: '', status: 'review',
    sections: [{ title: 'Steaks', items: [{ name: 'A', priceCents: 1000 }, { name: 'B', priceCents: 2000 }, { name: 'C', priceCents: 3000 }] }]
  };
  it('passes a sane menu', () => expect(validate(base).ok).toBe(true));
  it('rejects out-of-range prices, empty sections, tiny menus', () => {
    expect(validate({ ...base, sections: [{ title: 'x', items: [{ name: 'a', priceCents: 10 }, { name: 'b', priceCents: 60000 }, { name: 'c', priceCents: 500 }] }] }).failures).toHaveLength(2);
    expect(validate({ ...base, sections: [...base.sections, { title: 'empty', items: [] }] }).ok).toBe(false);
    expect(validate({ ...base, sections: [{ title: 's', items: [{ name: 'a', priceCents: 500 }] }] }).ok).toBe(false);
  });
  it('flags a >25% price change (milestone 8 acceptance)', () => {
    const next = structuredClone(base);
    next.sections[0].items[0].priceCents = 1300;
    const v = validate(next, base);
    expect(v.ok).toBe(false);
    expect(v.failures[0]).toMatch(/>25%/);
    next.sections[0].items[0].priceCents = 1200;
    expect(validate(next, base).ok).toBe(true);
  });
  it('flags ±30% item count swings and image sources', () => {
    const next = structuredClone(base);
    next.sections[0].items.push({ name: 'D', priceCents: 1 * 100 + 900 }, { name: 'E', priceCents: 1000 });
    expect(validate(next, base).failures.some((f) => f.includes('item count'))).toBe(true);
    expect(validate({ ...base, sourceType: 'image' }).ok).toBe(false);
  });
});
