<script lang="ts">
  import { onMount } from 'svelte';
  import Search from 'lucide-svelte/icons/search';
  import { loadCities, metroFor, nearestCity, search, warm, type Hit } from '$lib/search';
  import type { City } from '$lib/types';

  let q = $state('');
  let hits = $state<Hit[]>([]);
  let cities = $state<City[]>([]);
  let anchor = $state<City | null>(null);
  let metro: City[] = [];
  let here: { lat: number; lng: number } | undefined;
  let seq = 0;
  let canLocate = $state(false);

  const CITY_KEY = 'otm:city';

  async function setAnchor(c: City) {
    anchor = c;
    try { localStorage.setItem(CITY_KEY, c.slug); } catch {}
    metro = await metroFor(c);
    warm(metro);
    if (q.trim().length >= 2) run();
  }

  onMount(async () => {
    canLocate = 'geolocation' in navigator;
    cities = await loadCities();
    if (!cities.length) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(CITY_KEY); } catch {}
    // only use location if it was already granted — never prompt on page load
    const perm = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
    if (perm?.state === 'granted') {
      navigator.geolocation.getCurrentPosition((p) => {
        here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setAnchor(nearestCity(here, cities));
      }, () => {}, { maximumAge: 600_000, timeout: 5000 });
    }
    setAnchor(cities.find((c) => c.slug === saved) ?? cities[0]);
  });

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => {
      here = { lat: p.coords.latitude, lng: p.coords.longitude };
      setAnchor(nearestCity(here, cities));
    });
  }

  async function run() {
    const my = ++seq;
    const term = q.trim();
    if (term.length < 2) { hits = []; return; }
    const r = await search(term, metro, here);
    if (my === seq) hits = r;
  }

  const fmtKm = (km: number) => { const mi = km * 0.621371; return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`; };
</script>

<form class="wrap" role="search" onsubmit={(e) => { e.preventDefault(); if (hits[0]) location.href = `/${hits[0].citySlug}/${hits[0].slug}`; }}>
  <label class="bar pop">
    <Search size={24} strokeWidth={2.75} aria-hidden="true" />
    <span class="sr-only">search restaurants</span>
    <input type="search" bind:value={q} oninput={run} placeholder="what restaurant?"
      autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" />
  </label>

  {#if cities.length}
    <div class="where muted">
      <span>near</span>
      <select aria-label="city" value={anchor?.slug} onchange={(e) => { const c = cities.find((c) => c.slug === e.currentTarget.value); if (c) setAnchor(c); }}>
        {#each cities as c}<option value={c.slug}>{c.name}</option>{/each}
      </select>
      {#if canLocate}<button type="button" class="link" onclick={locate}>use my location</button>{/if}
    </div>
  {/if}

  {#if hits.length}
    <ul class="hits">
      {#each hits as h}
        <li><a class="pop hit" href="/{h.citySlug}/{h.slug}">
          <span class="n">{h.name}</span><span class="c muted">· {h.cityName}</span>{#if h.km !== undefined}<span class="d muted num">· {fmtKm(h.km)}</span>{/if}
        </a></li>
      {/each}
    </ul>
  {:else if q.trim().length >= 2}
    <p class="none">we don't know that one yet. <a href="/add">add it?</a></p>
  {/if}
</form>

<style>
  .wrap { margin: 0; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 0 14px; min-height: 60px; background: var(--mayo); cursor: text; }
  .bar:active { transform: none; box-shadow: var(--pop-shadow); }
  input {
    flex: 1; min-width: 0; height: 56px; border: 0; background: none; outline: none;
    font: 600 20px var(--font-ui); color: var(--ink);
  }
  input::placeholder { color: var(--ink-muted); opacity: 1; }
  input::-webkit-search-cancel-button { display: none; }
  .bar:focus-within { outline: 3px solid var(--ketchup); outline-offset: 3px; }
  .where { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px; font-size: 15px; }
  select { font: 600 15px var(--font-ui); color: var(--ink); background: var(--mayo-deep); border: 2px solid var(--ink); border-radius: 8px; min-height: 44px; padding: 0 8px; }
  .link { background: none; border: 0; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; min-height: 44px; font-size: 15px; color: var(--ink-muted); }
  .hits { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
  .hit { display: flex; align-items: center; gap: 6px; min-height: 52px; padding: 0 14px; text-decoration: none; flex-wrap: wrap; }
  .n { font-weight: 800; }
  .c, .d { font-size: 15px; }
  .none { margin: 14px 2px 0; }
</style>
