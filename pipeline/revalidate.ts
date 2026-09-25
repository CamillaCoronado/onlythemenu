export async function revalidate(paths: string[]) {
  const site = process.env.PUBLIC_SITE_URL, secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) { console.warn('revalidate skipped: PUBLIC_SITE_URL / REVALIDATE_SECRET unset'); return; }
  const q = paths.map((p) => `path=${encodeURIComponent(p)}`).join('&');
  const res = await fetch(`${site}/api/revalidate?${q}`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
  if (!res.ok) console.warn(`revalidate ${res.status}: ${await res.text()}`);
}
