# onlythemenu

you just wanted to see the menu. no cart. no pickup time. no app. just prices.

SvelteKit 2 + TypeScript on Vercel (ISR), Firebase (Firestore / Storage / Auth for owners + admin), MiniSearch, a deterministic no-LLM ingestion pipeline.

## run it

```sh
npm install
npm run dev          # reads /seed/*.json when FIREBASE_* is unset — no credentials needed
npm test             # vitest: price/normalize/validate/adapters/owner text format
npm run check        # svelte-check
npm run guard        # banned LLM/AI deps, client firebase outside /login, float prices
npm run build && npx vite preview --port 4173 && node tests/e2e.mjs   # acceptance checks in chromium
```

With Firebase: copy `.env.example` to `.env`, fill `FIREBASE_*`, then `npm run seed` (writes the 3 seed menus, `sourceType: 'owner'`, `verifiedAt: 2026-09-25`). Deploy `firestore.rules`, `firestore.indexes.json` (includes a TTL on `ratelimits.expiresAt`), and `storage.rules`.

## layout

```
src/app.css                    tokens + base styles (condiment pop)
src/lib/components/            MenuHeader, MenuSection, MenuItem, StickySectionTitle, JumpSheet, ReportSheet,
                               SearchBar, Burst, Starburst, EmptyPie, WordmarkGrid (+ Sheet, Price, Hl)
src/lib/server/                firebase admin, data (firestore | seed fallback), og image, publish, reports, rate limit
src/lib/menuText.ts            owner editor's plain-text menu format (round-trips every seed menu)
src/routes/                    /, /[city], /[city]/[slug], /add, /about, /login, /claim/[id], /owner, /owner/[id],
                               /admin/review, /api/{report,submit,revalidate,session}, /og/…png,
                               /sitemap.xml, /sitemap-[city].xml, /search/{[city],cities}.json
src/service-worker.ts          offline: last 20 menus viewed
pipeline/                      fetch → hash → detect → adapter → normalize → validate → publish | review
pipeline/adapters/             jsonld, html, pdf, image (tesseract), lines (shared pdf/ocr layout logic),
                               toast/square/chownow/clover (disabled until the legal read)
pipeline/fixtures/             3 fixtures each for jsonld / html / pdf + vitest snapshots
seed/                          the 3 real menus from the brief
```

## decisions worth knowing

- **Section nav** – each section's title is `position: sticky` inside its own `<section>`, so the next title pushes the current one off with zero JS. An IntersectionObserver only tracks which section is current, for the jump sheet highlight.
- **Search indexes are ISR routes, not files in `/static`.** Static assets can't be rewritten at runtime on Vercel, so `/search/{city}.json` and `/search/cities.json` are ISR (`expiration: false`), edge-cached like static files and revalidated on restaurant changes. The client searches every city within 80 km of the chosen city (the metro), so "angi" finds Angie's (Logan) even when Perry is selected.
- **Revalidation** – `/api/revalidate?path=…` (Bearer `REVALIDATE_SECRET`) HEADs each path with `x-prerender-revalidate`, which is Vercel's ISR bypass token. The same secret is the `bypassToken` in each route's `config.isr`.
- **Menu-page JS** is 46.8 KB gz (budget 50). About 33 KB of that is Svelte + the SvelteKit router. The jump and report sheets are lazy-loaded on first tap. The margin is thin, so watch it.
- **Contrast** – ink on pickle is 4.23:1, which fails AA for small text. The FRESH starburst uses a pickle ring with a pickle-light core, so its text is ink on light. Header meta on mustard is ink, not muted (muted on mustard is 3.52:1).
- **Figtree ships `tnum`.** It was verified in the font's GSUB table (its default digits are proportional), so prices set `font-variant-numeric: tabular-nums`. That resolves the open question: keep Figtree.
- **Fonts are self-hosted** (latin woff2 subsets, preloaded). There are no third-party requests on menu pages except Vercel's cookieless analytics, which is injected after hydration.
- **Restaurant ids** are `{citySlug}--{slug}`, because bare slugs collide across cities. `/claim/[slug]` takes the id.
- **Owner edits** skip the change-vs-last rules (owners know their prices) but still hit the absolute ones (price range, empty sections, ≥3 items).
- **Price reports**: 2 matching reports within 14 days auto-apply, unless the jump is more than 25% (the same rule as the pipeline). Anything else goes to `/admin/review`, grouped per item.
- **Claims** are never auto-granted. An admin approves after calling the restaurant's listed number.
- **`jose` is pinned to v4 by an `overrides` entry.** `firebase-admin` → `jwks-rsa@4` is CommonJS and `require()`s `jose`, but `jose@6` is ESM-only. Vercel's function loader has no `require(esm)` support, so every route 500s without the pin. jwks-rsa only uses `importJWK`, `exportSPKI`, `decodeJwt`, `decodeProtectedHeader`, all unchanged in v4. Remove the pin only once jwks-rsa ships ESM.

## known gaps

- **Milestone 7 against the live site is unverified.** maddoxfinefood.com and angiesrest.com were unreachable from the build container (network policy). The html/jsonld/pdf fixtures are *synthetic*, rendered from `/seed` in three markup styles (`pipeline/fixtures/generate.ts`). Capture the real pages into `pipeline/fixtures/real/` and add them to the test.
- **The image adapter has no fixtures.** Tesseract downloads its language data at runtime, which the container couldn't do. It shares `adapters/lines.ts` with the pdf adapter, and that code is tested.
- **The ordering-platform adapters throw on purpose** until the legal read. `detect.ts` still recognizes the platforms.
- **Seed `geo` is null.** `import-overture.ts` fills it by name + street number. Until then, search rows show no distance for the seeds.
- **Overture import** needs `--release <name>` and wasn't run here (no network). Check the category list against the release's taxonomy.
- **`hello@onlythemenu.com`** on /about is a placeholder until the domain is settled.
- **Lighthouse (local preview, simulated slow 4G):** perf 98, a11y 100, best-practices 96, SEO 100. LCP was 1.9 s under that throttle. The <1.0 s target on mid-range 4G still needs checking on a real device against the Vercel deploy.
- **CI workflows live in `ci/github-workflows/`** because the automation token couldn't push to `.github/workflows/`. Enable them with `git mv ci/github-workflows/*.yml .github/workflows/`. The pipeline workflow needs `FIREBASE_*` and `REVALIDATE_SECRET` secrets plus a `PUBLIC_SITE_URL` variable.
