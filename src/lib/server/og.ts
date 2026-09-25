import { Resvg } from '@resvg/resvg-js';
import { read } from '$app/server';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bagel from './og-fonts/bagel-fat-one-latin-400-normal.ttf';
import figtree600 from './og-fonts/figtree-latin-600-normal.ttf';
import figtree800 from './og-fonts/figtree-latin-800-normal.ttf';
import { formatCents } from '$lib/price';
import type { Item, Menu, Restaurant } from '$lib/types';

let fontFiles: Promise<string[]> | null = null;

/** resvg-js only takes font paths, so materialize the bundled fonts into /tmp once per instance */
function fonts(): Promise<string[]> {
  return (fontFiles ??= (async () => {
    const dir = join(tmpdir(), 'otm-og-fonts');
    await mkdir(dir, { recursive: true });
    return Promise.all(
      [bagel, figtree600, figtree800].map(async (asset) => {
        // asset urls are content-hashed, so a new font never reuses a stale file
        const p = join(dir, asset.split('/').pop()!);
        try { await access(p); } catch { await writeFile(p, Buffer.from(await read(asset).arrayBuffer())); }
        return p;
      })
    );
  })());
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** first three items that have a single price, preferring different sections */
export function pickItems(m: Menu, n = 3): { name: string; price: string }[] {
  const priced = (it: Item) => it.priceCents !== undefined || !!it.variants?.length;
  const price = (it: Item) => formatCents(it.priceCents ?? it.variants![0].priceCents);
  const out: Item[] = [];
  for (const s of m.sections) { const it = s.items.find(priced); if (it) out.push(it); if (out.length === n) break; }
  for (const s of m.sections) for (const it of s.items) if (out.length < n && priced(it) && !out.includes(it)) out.push(it);
  return out.slice(0, n).map((it) => ({ name: it.name, price: price(it) }));
}

export function ogSvg(r: Restaurant, m: Menu): string {
  const name = clip(r.name.toUpperCase(), 26);
  const size = name.length > 18 ? 64 : 84;
  const rows = pickItems(m).map((it, i) => {
    const y = 318 + i * 84;
    return `<text x="96" y="${y}" font-family="Figtree" font-weight="600" font-size="42" fill="#2B1B17">${esc(clip(it.name, 30))}</text>
      <line x1="${110 + Math.min(clip(it.name, 30).length, 30) * 21}" y1="${y - 8}" x2="930" y2="${y - 8}" stroke="#6E5A4E" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
      <text x="1104" y="${y}" text-anchor="end" font-family="Figtree" font-weight="800" font-size="40" fill="#2B1B17">${esc(it.price)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="d" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="2.4" fill="#2B1B17"/></pattern>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="m"><rect width="1200" height="630" fill="url(#f)"/></mask>
  </defs>
  <rect width="1200" height="630" fill="#F4B400"/>
  <rect width="1200" height="630" fill="url(#d)" mask="url(#m)"/>
  <rect x="48" y="220" width="1104" height="330" rx="24" fill="#2B1B17"/>
  <rect x="40" y="212" width="1104" height="330" rx="24" fill="#FFF6E0" stroke="#2B1B17" stroke-width="6"/>
  <text x="64" y="150" transform="rotate(-1 64 150)" font-family="Bagel Fat One" font-size="${size}" fill="#2B1B17">${esc(name)}</text>
  ${rows}
  <text x="1140" y="600" text-anchor="end" font-family="Figtree" font-weight="800" font-size="28" fill="#2B1B17">onlythemenu</text>
</svg>`;
}

export async function ogPng(r: Restaurant, m: Menu): Promise<Uint8Array> {
  const svg = ogSvg(r, m);
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: await fonts(), defaultFontFamily: 'Figtree' }, fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}
