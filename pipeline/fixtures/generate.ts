/**
 * SYNTHETIC fixtures rendered from /seed (the real restaurant sites aren't reachable from CI/dev containers).
 * three markup styles per adapter so the parsers can't overfit one theme. replace/extend with real
 * captures (pipeline/fixtures/real/*) once fetched: `npx tsx pipeline/fixtures/generate.ts`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSeeds } from '../seedFiles';
import { formatCents } from '../../src/lib/price';
import type { Item, Menu, Restaurant } from '../../src/lib/types';

const DIR = import.meta.dirname;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tagText = (it: Item) => (it.tags ?? []).map((t) => ` (${t})`).join('');
const priceText = (it: Item) =>
  it.marketPrice ? 'Market Price'
  : it.variants?.length ? it.variants.map((v) => `${v.label} ${formatCents(v.priceCents)}`).join(' | ')
  : it.priceCents !== undefined ? formatCents(it.priceCents) : '';

const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<script>window.dataLayer=[];</script><style>.x{}</style></head><body>
<header><nav><a href="/">Home</a> <a href="/menu">Menu</a> <span class="price">$0.00 gift cards</span></nav></header>
<main>${body}</main><footer>© 2026 · Call (435) 555-0100 · Open 11–9</footer></body></html>`;

/** elementor-style price list widget (common on wordpress restaurant sites) */
function elementor(r: Omit<Restaurant, 'id'>, m: Menu) {
  return page(r.name, m.sections.map((s) => `
<div class="elementor-widget-heading"><h2 class="elementor-heading-title">${esc(s.title)}</h2></div>
${s.note ? `<div class="elementor-text-editor"><p>${esc(s.note)}</p></div>` : ''}
<div class="elementor-widget-price-list"><ul class="elementor-price-list">
${s.items.map((it) => `<li class="elementor-price-list-item"><div class="elementor-price-list-text">
  <div class="elementor-price-list-header"><span class="elementor-price-list-title">${esc(it.name + tagText(it))}</span>
  <span class="elementor-price-list-separator"></span><span class="elementor-price-list-price">${esc(priceText(it))}</span></div>
  ${it.description ? `<p class="elementor-price-list-description">${esc(it.description)}</p>` : ''}
</div></li>`).join('\n')}
</ul></div>`).join('\n'));
}

/** hand-rolled theme: div cards, h4 names, sections as h3 */
function cards(r: Omit<Restaurant, 'id'>, m: Menu) {
  return page(r.name, `<h1>${esc(r.name)} Menu</h1>` + m.sections.map((s) => `
<section class="menu-section"><h3>${esc(s.title)}</h3>
<div class="items">${s.items.map((it) => `
  <div class="menu-item"><div class="row"><h4>${esc(it.name + tagText(it))}</h4><span class="menu-price">${esc(priceText(it))}</span></div>
  ${it.description ? `<p>${esc(it.description)}</p>` : ''}</div>`).join('')}
</div></section>`).join('\n'));
}

/** old-school tables */
function tables(r: Omit<Restaurant, 'id'>, m: Menu) {
  return page(r.name, m.sections.map((s) => `
<h2>${esc(s.title)}</h2><table class="menu"><tbody>
${s.items.map((it) => `<tr><td class="n"><strong>${esc(it.name + tagText(it))}</strong>${it.description ? `<br><small>${esc(it.description)}</small>` : ''}</td><td class="p">${esc(priceText(it))}</td></tr>`).join('\n')}
</tbody></table>`).join('\n'));
}

function jsonldMenu(m: Menu) {
  return {
    '@type': 'Menu',
    hasMenuSection: m.sections.map((s) => ({
      '@type': 'MenuSection', name: s.title, ...(s.note && { description: s.note }),
      hasMenuItem: s.items.map((it) => ({
        '@type': 'MenuItem', name: it.name, ...(it.description && { description: it.description }),
        ...(it.tags?.length && { suitableForDiet: it.tags.map((t) => `https://schema.org/${{ V: 'VegetarianDiet', VG: 'VeganDiet', GF: 'GlutenFreeDiet', spicy: '' }[t]}`) }),
        ...(it.variants?.length ? { offers: it.variants.map((v) => ({ '@type': 'Offer', name: v.label, price: (v.priceCents / 100).toFixed(2), priceCurrency: 'USD' })) }
          : it.priceCents !== undefined ? { offers: { '@type': 'Offer', price: it.priceCents / 100, priceCurrency: 'USD' } }
          : it.marketPrice ? { offers: { '@type': 'Offer', price: 'Market Price', priceCurrency: 'USD' } } : {})
      }))
    }))
  };
}
const ld = (o: unknown, r: Omit<Restaurant, 'id'>) => page(r.name, `<p>see our menu below</p>`).replace('</head>', `<script type="application/ld+json">${JSON.stringify(o)}</script></head>`);

/** minimal hand-built PDF: helvetica, section titles 18pt, items 11pt, price right-aligned-ish at x=500 */
function pdf(m: Menu): Buffer {
  const pages: string[][] = [[]];
  let y = 760;
  const put = (s: string) => pages[pages.length - 1].push(s);
  const t = (x: number, yy: number, size: number, str: string) =>
    put(`BT /F1 ${size} Tf ${x} ${yy} Td (${str.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, (c) => ({ '–': '-', 'é': 'e', '’': "'" } as Record<string, string>)[c] ?? '?')}) Tj ET`);
  const need = (h: number) => { if (y - h < 40) { pages.push([]); y = 760; } };
  for (const s of m.sections) {
    need(60); t(50, y, 18, s.title); y -= 26;
    if (s.note) { t(50, y, 9, s.note); y -= 16; }
    for (const it of s.items) {
      need(30);
      const p = priceText(it);
      t(50, y, 11, it.name + tagText(it));
      t(it.variants?.length ? 250 : 500, y, 11, p.replace(/ \| /g, '  '));
      y -= 14;
      if (it.description) { t(62, y, 9, it.description); y -= 14; }
      y -= 4;
    }
    y -= 8;
  }
  const objs: string[] = [];
  const add = (s: string) => (objs.push(s), objs.length);
  const catalog = add(''); const pagesId = add(''); const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const pg of pages) {
    const stream = pg.join('\n');
    const c = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const seeds = Object.fromEntries(readSeeds().map((s) => [s.restaurant.slug, s]));
const w = (p: string, c: string | Buffer) => { mkdirSync(join(DIR, p, '..'), { recursive: true }); writeFileSync(join(DIR, p), c); console.log(p); };
const R = seeds['maddox-ranch-house'], D = seeds['maddox-drive-in'], A = seeds['angies'];

w('html/maddox-ranch-house.elementor.html', elementor(R.restaurant, R.menu));
w('html/angies.cards.html', cards(A.restaurant, A.menu));
w('html/maddox-drive-in.tables.html', tables(D.restaurant, D.menu));
w('jsonld/maddox-ranch-house.menu.html', ld({ '@context': 'https://schema.org', ...jsonldMenu(R.menu) }, R.restaurant));
w('jsonld/angies.restaurant.html', ld({ '@context': 'https://schema.org', '@type': 'Restaurant', name: A.restaurant.name, hasMenu: jsonldMenu(A.menu) }, A.restaurant));
w('jsonld/maddox-drive-in.graph.html', ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, { '@type': 'Restaurant', name: D.restaurant.name, hasMenu: jsonldMenu(D.menu) }] }, D.restaurant));
w('pdf/maddox-ranch-house.pdf', pdf(R.menu));
w('pdf/angies.pdf', pdf(A.menu));
w('pdf/maddox-drive-in.pdf', pdf(D.menu));
