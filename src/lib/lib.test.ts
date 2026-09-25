import { describe, expect, it } from 'vitest';
import { ariaCents, formatCents, parseCents } from './price';
import { freshness } from './freshness';
import { itemMatches, segments } from './find';
import { nearestCity } from './cities';

describe('price', () => {
  it('formats integer cents', () => {
    expect(formatCents(3295)).toBe('$32.95');
    expect(formatCents(300)).toBe('$3.00');
    expect(formatCents(125000)).toBe('$1,250.00');
    expect(() => formatCents(32.95)).toThrow();
  });
  it('aria', () => {
    expect(ariaCents(3295)).toBe('32 dollars 95');
    expect(ariaCents(100)).toBe('1 dollar');
  });
  it('parses', () => {
    expect(parseCents('$32.95')).toBe(3295);
    expect(parseCents('32.9')).toBe(3290);
    expect(parseCents('abc')).toBeNull();
  });
});

describe('freshness starburst', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  it('≤30 days is pickle FRESH', () => {
    const f = freshness(daysAgo(3), now);
    expect(f.tone).toBe('pickle');
    expect(f.label).toBe('fresh! checked 3 days ago');
  });
  it('31–90 days is mustard', () => {
    const f = freshness(daysAgo(60), now);
    expect(f.tone).toBe('mustard');
    expect(f.label).toBe('checked 2 months ago');
  });
  it('>90 days might be stale', () => {
    expect(freshness(new Date('2026-03-10T12:00:00Z'), now).label).toBe('might be stale — last checked march');
    expect(freshness(new Date('2025-03-10T12:00:00Z'), now).label).toBe('might be stale — last checked march 2025');
  });
});

describe('find', () => {
  it('matches name or description, case-insensitive', () => {
    expect(itemMatches({ name: 'Top of Maddox', description: 'Filet, fried shrimp' }, 'SHRIMP')).toBe(true);
    expect(itemMatches({ name: 'Trout' }, 'shrimp')).toBe(false);
  });
  it('segments', () => {
    expect(segments('Shrimp steak + fried shrimp.', 'shrimp').filter((s) => s.hit)).toHaveLength(2);
  });
});

describe('cities', () => {
  it('nearest', () => expect(nearestCity({ lat: 41.74, lng: -111.83 }).slug).toBe('logan-ut'));
});
