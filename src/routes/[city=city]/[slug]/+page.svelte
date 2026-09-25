<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/state';
  import X from 'lucide-svelte/icons/x';
  import Camera from 'lucide-svelte/icons/camera';
  import MenuHeader from '$lib/components/MenuHeader.svelte';
  import MenuSection from '$lib/components/MenuSection.svelte';
  // sheets load on first tap: keeps them out of the initial menu-page js
  type JumpT = typeof import('$lib/components/JumpSheet.svelte').default;
  type ReportT = typeof import('$lib/components/ReportSheet.svelte').default;
  let JumpSheet = $state<JumpT | null>(null);
  let ReportSheet = $state<ReportT | null>(null);
  const loadJump = async () => (JumpSheet ??= (await import('$lib/components/JumpSheet.svelte')).default);
  const loadReport = async () => (ReportSheet ??= (await import('$lib/components/ReportSheet.svelte')).default);
  import EmptyPie from '$lib/components/EmptyPie.svelte';
  import { freshness, shortDate } from '$lib/freshness';
  import { itemMatches } from '$lib/find';
  import { pushRecent } from '$lib/recent';
  import { menuJsonLd, ldString } from './jsonld';

  let { data } = $props();
  const r = $derived(data.restaurant);
  const m = $derived(data.menu);
  const fresh = $derived(m ? freshness(m.verifiedAt) : null);
  const canonical = $derived(`${page.url.origin}/${r.citySlug}/${r.slug}`);

  let jumpOpen = $state(false);
  let current = $state(0);
  let findOpen = $state(false);
  let q = $state('');
  let findInput = $state<HTMLInputElement>();
  let reportOpen = $state(false);
  let target = $state<{ s: number; i: number } | null>(null);
  let thanksKey = $state('');

  const matches = $derived(m && q.trim() ? m.sections.reduce((n, s) => n + s.items.filter((it) => itemMatches(it, q)).length, 0) : 0);
  const targetItem = $derived(m && target ? m.sections[target.s].items[target.i] : null);

  onMount(() => {
    pushRecent({ href: `/${r.citySlug}/${r.slug}`, name: r.name, city: data.cityName });
    if (!m) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) current = Number((e.target as HTMLElement).dataset.idx);
    }, { rootMargin: '-64px 0px -75% 0px' });
    document.querySelectorAll('section[data-idx]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  });

  function jump(i: number) {
    jumpOpen = false;
    document.getElementById(`s${i}`)?.scrollIntoView({ block: 'start' });
  }

  async function openFind() {
    findOpen = true;
    await tick();
    findInput?.focus();
  }
  function closeFind() { findOpen = false; q = ''; }

  async function openJump() { await loadJump(); jumpOpen = true; }
  async function report(s: number, i: number) { target = { s, i }; await loadReport(); reportOpen = true; }

  async function submitReport(cents: number, variant?: string): Promise<boolean> {
    if (!target || !targetItem) return false;
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restaurantId: r.id, sectionIdx: target.s, itemIdx: target.i, itemName: targetItem.name, variantLabel: variant, reportedCents: cents })
    }).catch(() => null);
    if (!res?.ok) return false;
    reportOpen = false;
    thanksKey = `${target.s}:${target.i}`;
    setTimeout(() => (thanksKey = ''), 1000);
    return true;
  }
</script>

<svelte:head>
  <title>{r.name} menu + prices · onlythemenu</title>
  <meta name="description" content={m ? `${r.name} menu with prices. ${m.sections.map((s) => s.title.toLowerCase()).slice(0, 5).join(', ')}.` : `${r.name}, ${r.address}`} />
  <link rel="canonical" href={canonical} />
  <meta property="og:title" content="{r.name} — just the menu" />
  <meta property="og:url" content={canonical} />
  {#if m}
    <meta property="og:image" content="{page.url.origin}/og/{r.citySlug}/{r.slug}.png" />
    <meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    {@html `<script type="application/ld+json">${ldString(menuJsonLd(r, m, canonical))}</script>`}
  {/if}
</svelte:head>

<MenuHeader {r} {fresh} />

{#if m}
  <main class="menu" class:finding={findOpen}>
    {#if m.houseNotes}<p class="house muted">{m.houseNotes}</p>{/if}

    {#if findOpen}
      <div class="findbar">
        <label class="field pop">
          <span class="sr-only">find in menu</span>
          <input bind:this={findInput} bind:value={q} type="search" placeholder="find on this menu" enterkeyhint="search"
            onkeydown={(e) => e.key === 'Escape' && closeFind()} />
        </label>
        <span class="count num muted" aria-live="polite">{q.trim() ? `${matches}` : ''}</span>
        <button class="icon-btn" onclick={closeFind} aria-label="close find"><X size={24} strokeWidth={2.75} /></button>
      </div>
    {/if}

    {#each m.sections as section, idx}
      <MenuSection {section} {idx} {q} {thanksKey} onjump={openJump} onfind={openFind} onreport={(i) => report(idx, i)} />
    {/each}
  </main>

  <footer class="foot">
    {#if r.orderUrl || r.website}
      <p class="order">want to actually order? → <a href={r.orderUrl ?? r.website} rel="noopener">{new URL(r.orderUrl ?? r.website!).hostname.replace(/^www\./, '')}</a></p>
    {/if}
    <p class="muted src">
      source: <a href={m.sourceUrl} rel="noopener nofollow">{new URL(m.sourceUrl).hostname.replace(/^www\./, '')}</a>
      · last checked {shortDate(m.verifiedAt)}
    </p>
    <p class="muted src"><a href="/{r.citySlug}">more in {data.cityName.toLowerCase()}</a> · <a href="/claim/{r.id}" rel="nofollow">own this place?</a> · <a href="/">onlythemenu</a></p>
  </footer>

  {#if JumpSheet}<JumpSheet bind:open={jumpOpen} sections={m.sections} {current} onpick={jump} />{/if}
  {#if ReportSheet}<ReportSheet bind:open={reportOpen} item={targetItem} onsubmit={submitReport} />{/if}
{:else}
  <main class="empty">
    <EmptyPie />
    <h2 class="display">no menu yet… snap one?</h2>
    <a class="pop btn mustard" href="/add?r={encodeURIComponent(r.id)}"><Camera size={22} strokeWidth={2.75} aria-hidden="true" /> add the menu</a>
    {#if r.orderUrl || r.website}<p class="muted">or peek at <a href={r.orderUrl ?? r.website} rel="noopener">their site</a></p>{/if}
  </main>
{/if}

<style>
  .menu { padding-top: 14px; }
  .house { margin: 0 var(--pad) 12px; font-size: 15px; }
  .finding { --stick-top: calc(var(--safe-top) + 64px); --safe-mul: 0; }
  .findbar {
    position: sticky; top: 0; z-index: 4;
    display: flex; align-items: center; gap: 8px;
    padding: calc(var(--safe-top) + 6px) 6px 6px var(--pad);
    height: calc(var(--safe-top) + 64px);
    background: var(--mayo);
  }
  .field { flex: 1; display: flex; min-height: 48px; background: var(--mayo-deep); }
  .field:active { transform: none; box-shadow: var(--pop-shadow); }
  .field input { flex: 1; min-width: 0; border: 0; background: none; outline: none; padding: 0 12px; font: 600 17px var(--font-ui); color: var(--ink); }
  .field input::-webkit-search-cancel-button { display: none; }
  .field:focus-within { outline: 3px solid var(--ketchup); outline-offset: 2px; }
  .count { min-width: 2ch; font-weight: 800; text-align: right; }
  .foot { padding: 20px var(--pad) calc(40px + env(safe-area-inset-bottom, 0px)); border-top: var(--line); }
  .order { font-weight: 800; font-size: 18px; margin: 0 0 12px; }
  .order a { display: inline-flex; align-items: center; min-height: 44px; }
  .src { font-size: 15px; margin: 4px 0; }
  .src a { display: inline-flex; align-items: center; min-height: 44px; }
  .empty { padding: 40px var(--pad) 60px; text-align: center; position: relative; }
  .empty::before {
    content: ''; position: absolute; inset: 0; background: var(--dots); opacity: .1;
    -webkit-mask: radial-gradient(circle at 50% 30%, #000, transparent 60%); mask: radial-gradient(circle at 50% 30%, #000, transparent 60%);
    pointer-events: none;
  }
  .empty h2 { font-size: 26px; margin: 18px 0; position: relative; }
  .empty .btn { position: relative; }
  .empty p { position: relative; margin-top: 18px; }
</style>
