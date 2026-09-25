export type Recent = { href: string; name: string; city: string };
const KEY = 'otm:recent';

export function getRecent(): Recent[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function pushRecent(r: Recent, max = 20): void {
  try {
    const next = [r, ...getRecent().filter((x) => x.href !== r.href)].slice(0, max);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* private mode */ }
}
