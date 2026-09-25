/** all money is integer cents. these are the only places it becomes a string. */

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`non-integer cents: ${cents}`);
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  return `$${dollars.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`;
}

/** "32 dollars 95" — what the brief asks screen readers to hear */
export function ariaCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  const d = `${dollars} ${dollars === 1 ? 'dollar' : 'dollars'}`;
  return rem ? `${d} ${rem}` : d;
}

/** "32.95", "$32.95", "32", "1,250.00" -> cents. null if unparseable. */
export function parseCents(input: string): number | null {
  const m = input.replace(/\s/g, '').match(/^\$?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const dollars = parseInt(m[1].replace(/,/g, ''), 10);
  const c = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  return dollars * 100 + c;
}
