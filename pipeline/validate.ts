import type { Item, Menu } from '../src/lib/types';

export type Verdict = { ok: boolean; failures: string[] };

const prices = (it: Item): number[] => [
  ...(it.priceCents !== undefined ? [it.priceCents] : []),
  ...(it.variants ?? []).map((v) => v.priceCents)
];
const key = (section: string, name: string) => `${section.toLowerCase().trim()}\u0000${name.toLowerCase().trim()}`;
const itemCount = (m: Menu) => m.sections.reduce((n, s) => n + s.items.length, 0);

/** section 6 rules. anything failing goes to /admin/review instead of live. */
export function validate(next: Menu, prev?: Menu | null): Verdict {
  const f: string[] = [];

  for (const s of next.sections) {
    if (!s.items.length) f.push(`section "${s.title}" has 0 items`);
    for (const it of s.items) {
      for (const c of prices(it)) {
        if (!Number.isInteger(c)) f.push(`"${it.name}" has non-integer cents ${c}`);
        else if (c < 50) f.push(`"${it.name}" priced under $0.50 (${c}¢)`);
        else if (c > 50_000) f.push(`"${it.name}" priced over $500 (${c}¢)`);
      }
    }
  }
  const total = itemCount(next);
  if (total < 3) f.push(`only ${total} items total`);

  if (prev) {
    const before = itemCount(prev);
    if (before > 0 && Math.abs(total - before) / before > 0.3) f.push(`item count changed ${before} → ${total} (>±30%)`);

    const old = new Map<string, Item>();
    for (const s of prev.sections) for (const it of s.items) old.set(key(s.title, it.name), it);
    for (const s of next.sections) for (const it of s.items) {
      const o = old.get(key(s.title, it.name));
      if (!o) continue;
      const a = prices(o), b = prices(it);
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] > 0 && Math.abs(b[i] - a[i]) / a[i] > 0.25) f.push(`"${it.name}" price changed ${a[i]}¢ → ${b[i]}¢ (>25%)`);
      }
    }
  }
  if (next.sourceType === 'image') f.push('image-sourced menus always get a human look');
  return { ok: f.length === 0, failures: f };
}
