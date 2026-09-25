const DAY = 86_400_000;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export type Freshness = { tone: 'pickle' | 'mustard'; label: string; lines: string[] };

export function ago(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 45) return `${Math.round(days / 7)} weeks ago`;
  const m = Math.round(days / 30);
  return m <= 1 ? 'a month ago' : `${m} months ago`;
}

export function freshness(verifiedAt: string | Date, now: Date = new Date()): Freshness {
  const v = new Date(verifiedAt);
  const days = Math.max(0, Math.floor((now.getTime() - v.getTime()) / DAY));
  if (days <= 30) {
    return { tone: 'pickle', label: `fresh! checked ${ago(days)}`, lines: ['FRESH!', `CHECKED ${ago(days).toUpperCase()}`] };
  }
  if (days <= 90) {
    return { tone: 'mustard', label: `checked ${ago(days)}`, lines: ['CHECKED', ago(days).toUpperCase()] };
  }
  const month = MONTHS[v.getUTCMonth()];
  const when = v.getUTCFullYear() === now.getUTCFullYear() ? month : `${month} ${v.getUTCFullYear()}`;
  return { tone: 'mustard', label: `might be stale — last checked ${when}`, lines: ['MIGHT BE STALE', `LAST CHECKED ${when.toUpperCase()}`] };
}

export function shortDate(d: string | Date): string {
  const v = new Date(d);
  return `${MONTHS[v.getUTCMonth()]} ${v.getUTCDate()}, ${v.getUTCFullYear()}`;
}
