<script lang="ts">
  import type { Restaurant } from '$lib/types';
  import type { Freshness } from '$lib/freshness';
  import Share from 'lucide-svelte/icons/share';
  import Starburst from './Starburst.svelte';
  import Burst from './Burst.svelte';

  let { r, fresh }: { r: Restaurant; fresh: Freshness | null } = $props();
  let copied = $state(false);

  const mapsHref = $derived(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${r.address}`)}`);
  const tel = $derived(r.phone ? `tel:+1${r.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}` : '');

  async function share() {
    const data = { title: `${r.name} menu`, text: `${r.name} — just the menu.`, url: location.href };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* dismissed */ }
      return;
    }
    await navigator.clipboard.writeText(location.href);
    copied = true;
    setTimeout(() => (copied = false), 1000);
  }
</script>

<header class="hdr">
  <div class="top">
    <a href="/" class="home">onlythemenu</a>
    <button class="icon-btn share" onclick={share} aria-label="share this menu"><Share size={22} strokeWidth={2.75} /></button>
  </div>
  <h1 class="name display">{r.name}</h1>
  <p class="meta">
    <a href={mapsHref} rel="noopener">{r.address}</a>
    {#if r.phone}<a href={tel}>{r.phone}</a>{/if}
  </p>
  {#if fresh}<div class="stuck"><Starburst {fresh} /></div>{/if}
  {#if copied}<Burst text="COPIED!" />{/if}
</header>

<style>
  .hdr {
    position: relative;
    padding: calc(var(--safe-top) + 6px) var(--pad) 26px;
    background: var(--mustard);
    border-bottom: var(--line);
  }
  /* halftone, fading toward the bottom */
  .hdr::before {
    content: ''; position: absolute; inset: 0;
    background: var(--dots); opacity: .15;
    -webkit-mask: linear-gradient(#000, transparent 85%);
            mask: linear-gradient(#000, transparent 85%);
    pointer-events: none;
  }
  .top { position: relative; display: flex; align-items: center; justify-content: space-between; margin-right: -10px; }
  .home { font-weight: 800; font-size: 15px; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  .name {
    position: relative;
    margin: 18px 108px 6px 0; min-height: 100px; display: flex; align-items: flex-end;
    font-size: clamp(40px, 11vw, 56px); line-height: .98;
    text-transform: uppercase;
    transform: rotate(-1deg); transform-origin: left center;
    overflow-wrap: anywhere;
  }
  .meta { position: relative; display: flex; flex-direction: column; align-items: flex-start; margin: 0; font-weight: 600; font-size: 15px; line-height: 1.3; }
  .meta a { display: inline-flex; align-items: center; min-height: 44px; }
  .stuck { position: absolute; right: 4px; top: calc(var(--safe-top) + 50px); z-index: 4; }
</style>
