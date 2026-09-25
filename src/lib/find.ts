import type { Item } from './types';

export type Seg = { text: string; hit: boolean };

/** split text on case-insensitive matches of q */
export function segments(text: string, q: string): Seg[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [{ text, hit: false }];
  const hay = text.toLowerCase();
  const out: Seg[] = [];
  let i = 0;
  for (let j = hay.indexOf(needle); j !== -1; j = hay.indexOf(needle, i)) {
    if (j > i) out.push({ text: text.slice(i, j), hit: false });
    out.push({ text: text.slice(j, j + needle.length), hit: true });
    i = j + needle.length;
  }
  if (i < text.length) out.push({ text: text.slice(i), hit: false });
  return out;
}

export function itemMatches(item: Item, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return item.name.toLowerCase().includes(n) || (item.description?.toLowerCase().includes(n) ?? false);
}
