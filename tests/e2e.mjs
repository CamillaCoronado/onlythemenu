// acceptance checks for milestones 2–5. run against `vite preview`: node tests/e2e.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { gzipSync } from 'node:zlib';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fail++; };

// --- menu page: js budget
const page = await ctx.newPage();
const js = [];
page.on('response', async (r) => {
  if (r.request().resourceType() === 'script' && r.url().startsWith(BASE)) {
    const b = await r.body().catch(() => Buffer.alloc(0));
    js.push(b);
    if (process.env.VERBOSE) console.log(`   ${(gzipSync(b).length / 1024).toFixed(1)} KB  ${r.url().replace(BASE, '')}`);
  }
});
await page.goto(`${BASE}/perry-ut/maddox-ranch-house`, { waitUntil: 'networkidle' });
const gz = js.reduce((n, b) => n + gzipSync(b).length, 0);
ok(gz < 50 * 1024, `menu page js ${(gz / 1024).toFixed(1)} KB gz (${js.length} files) < 50 KB`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-top.png` });

// --- sections + sticky title swap across all 11
const titles = await page.$$eval('section h2', (h) => h.map((x) => x.textContent.trim()));
ok(titles.length === 11, `11 sections (${titles.length})`);
let swaps = 0;
for (let i = 0; i < titles.length; i++) {
  // park the viewport 30px into the section (fully past the previous title's push-off)
  await page.evaluate((i) => window.scrollTo(0, document.getElementById(`s${i}`).offsetTop + 30), i);
  await page.waitForTimeout(60);
  const stuck = await page.evaluate(() => {
    const el = document.elementFromPoint(40, 20);
    return el?.closest('section')?.querySelector('h2')?.textContent.trim();
  });
  // the last section may be too short to scroll its title to the top; then it just has to be the topmost title on screen
  const clamped = await page.evaluate((i) => window.scrollY < document.getElementById(`s${i}`).offsetTop, i);
  const visible = clamped && (await page.evaluate((i) => document.getElementById(`s${i}`).getBoundingClientRect().top < innerHeight, i));
  if (stuck === titles[i] || (clamped && visible && i === titles.length - 1)) swaps++; else console.log(`   section ${i}: expected "${titles[i]}", saw "${stuck}"`);
}
ok(swaps === titles.length, `sticky title correct in ${swaps}/${titles.length} sections`);
if (SHOTS) { await page.evaluate(() => { document.getElementById('s2').scrollIntoView(); window.scrollBy(0, 200); }); await page.screenshot({ path: `${SHOTS}/menu-sticky.png` }); }

// --- jump sheet
await page.click('#s2 h2 button');
await page.waitForSelector('dialog[open]');
const counts = await page.$$eval('dialog[open] li', (l) => l.length);
ok(counts === 11, `jump sheet lists 11 sections`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/jump.png` });
await page.click('dialog[open] li:nth-child(10) button');
await page.waitForTimeout(100);
const top = await page.evaluate(() => document.getElementById('s9').getBoundingClientRect().top);
ok(Math.abs(top) < 6, `jump scrolled to section 10 (top=${top.toFixed(0)})`);

// --- in-menu find
await page.click('#s9 [aria-label="find in menu"]');
await page.fill('.findbar input', 'shrimp');
await page.waitForTimeout(50);
const lit = await page.$$eval('li.item:not(.dim)', (l) => l.length);
const marks = await page.$$eval('li.item mark', (l) => l.length);
ok(lit === 8, `find "shrimp" leaves 8 items undimmed (${lit}), ${marks} highlights`);
if (SHOTS) { await page.evaluate(() => document.getElementById('s4').scrollIntoView()); await page.screenshot({ path: `${SHOTS}/find.png` }); }
await page.click('[aria-label="close find"]');

// --- report flow
await page.evaluate(() => document.getElementById('s0').scrollIntoView());
await page.click('#s0 li.item:nth-child(3) .row');
await page.click('#s0 li.item:nth-child(3) >> text=price changed?');
await page.waitForSelector('dialog[open]');
for (const k of ['3', '9', '9', '5']) await page.click(`dialog[open] .key[aria-label="${k}"]`);
const amt = await page.textContent('dialog[open] output');
ok(amt === '$39.95', `keypad shows ${amt}`);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/report.png` });
const [resp] = await Promise.all([page.waitForResponse('**/api/report'), page.click('dialog[open] .send')]);
ok(resp.ok(), `POST /api/report ${resp.status()}`);
ok(await page.isVisible('#s0 li.item:nth-child(3) .burst'), 'THANKS! burst shows');
if (SHOTS) await page.screenshot({ path: `${SHOTS}/thanks.png` });
await page.waitForTimeout(1100);
ok(!(await page.isVisible('#s0 li.item:nth-child(3) .burst')), 'burst gone after 1s');

// --- json-ld
const ld = JSON.parse(await page.$eval('script[type="application/ld+json"]', (s) => s.textContent));
ok(ld.hasMenu?.hasMenuSection?.length === 11, 'json-ld Menu with 11 sections');

// --- axe on menu + home
const a1 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
ok(a1.violations.length === 0, `axe menu: ${a1.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'clean'}`);

// --- home search
const home = await ctx.newPage();
await home.goto(BASE, { waitUntil: 'networkidle' });
if (SHOTS) await home.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });
await home.focus('input[type=search]');
for (const [q, want] of [['mad', ['Maddox Ranch House', 'Maddox Family Drive-In']], ['angi', ["Angie's Restaurant"]]]) {
  await home.fill('input[type=search]', '');
  await home.waitForTimeout(50);
  // one input event -> results in the DOM, timed in-page (index already warm, as it is after focus)
  const dt = await home.evaluate((q) => new Promise((res) => {
    const input = document.querySelector('input[type=search]');
    const t0 = performance.now();
    const mo = new MutationObserver(() => { if (document.querySelector('.hits a')) { mo.disconnect(); res(performance.now() - t0); } });
    mo.observe(document.body, { childList: true, subtree: true });
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }), q);
  const got = await home.$$eval('.hits .n', (n) => n.map((x) => x.textContent));
  ok(want.every((w) => got.includes(w)) && dt < 50, `"${q}" -> ${got.join(' | ')} in ${dt.toFixed(1)} ms (< 50)`);
}
if (SHOTS) await home.screenshot({ path: `${SHOTS}/search.png` });
const a2 = await new AxeBuilder({ page: home }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
ok(a2.violations.length === 0, `axe home: ${a2.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'clean'}`);

// --- recent menus on home
ok(await home.isVisible('text=Maddox Ranch House >> nth=0'), 'recent menus shows maddox');

// --- 404 + city
const nf = await ctx.newPage();
const r404 = await nf.goto(`${BASE}/perry-ut/nope`);
ok(r404.status() === 404 && (await nf.isVisible("text=we don't know that one yet")), '404 copy');
const city = await nf.goto(`${BASE}/perry-ut`);
ok(city.ok() && (await nf.$$eval('main li', (l) => l.length)) === 2, '/perry-ut lists 2');
const a3 = await new AxeBuilder({ page: nf }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
ok(a3.violations.length === 0, `axe city: ${a3.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ') || 'clean'}`);

// --- desktop
const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desk.goto(`${BASE}/logan-ut/angies`, { waitUntil: 'networkidle' });
if (SHOTS) await desk.screenshot({ path: `${SHOTS}/desktop.png` });
const w = await desk.$eval('.col', (e) => e.getBoundingClientRect().width);
ok(w === 640, `desktop column ${w}px`);

await browser.close();
console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
