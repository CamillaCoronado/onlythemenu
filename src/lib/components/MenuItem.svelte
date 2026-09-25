<script lang="ts">
  import type { Item } from '$lib/types';
  import Hl from './Hl.svelte';
  import Price from './Price.svelte';
  import Burst from './Burst.svelte';

  let {
    item, q = '', dim = false, thanks = false, onreport
  }: { item: Item; q?: string; dim?: boolean; thanks?: boolean; onreport: () => void } = $props();

  let open = $state(false);
  const hasSinglePrice = $derived(item.priceCents !== undefined && !item.variants?.length);
</script>

<li class="item" class:dim>
  <button class="row" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="line">
      <span class="name"><Hl text={item.name} {q} />{#each item.tags ?? [] as t}<span class="tag" title={t}>{t === 'spicy' ? '🌶' : t}</span>{/each}</span>
      {#if hasSinglePrice || (item.marketPrice && !item.variants?.length)}
        <span class="leader" aria-hidden="true"></span>
        {#if hasSinglePrice}<Price cents={item.priceCents!} />{:else}<span class="mkt" aria-label="market price">MKT</span>{/if}
      {/if}
    </span>
    {#if item.variants?.length}
      <span class="variants">
        {#each item.variants as v, i}{#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}<span class="v">{v.label} <Price cents={v.priceCents} /></span>{/each}
      </span>
    {/if}
    {#if item.description}<span class="desc"><Hl text={item.description} {q} /></span>{/if}
  </button>
  {#if open}
    <div class="more">
      <button class="pop btn pickle" onclick={onreport}>price changed?</button>
    </div>
  {/if}
  {#if thanks}<Burst text="THANKS!" />{/if}
</li>

<style>
  .item { position: relative; list-style: none; transition: opacity 120ms; }
  .dim { opacity: .25; }
  .row {
    display: block; width: 100%; min-height: 44px;
    padding: 10px var(--pad);
    background: none; border: 0; text-align: left; cursor: pointer;
  }
  .line { display: flex; align-items: baseline; gap: 8px; }
  .name { font-weight: 600; font-size: 17px; }
  .tag {
    display: inline-block; margin-left: 6px; padding: 0 4px;
    border: 1.5px solid var(--ink); border-radius: 4px;
    font-size: 11px; font-weight: 800; line-height: 15px; vertical-align: 2px;
  }
  .leader { flex: 1; min-width: 16px; border-bottom: 2px dotted var(--ink-muted); transform: translateY(-4px); }
  .mkt {
    padding: 1px 6px; border: 2px solid var(--ink); border-radius: 4px;
    background: var(--mustard); font-size: 12px; font-weight: 800; letter-spacing: .06em;
    transform: rotate(-2deg);
  }
  .variants { display: block; margin-top: 2px; font-size: 16px; }
  .v { white-space: nowrap; }
  .sep { color: var(--ink-muted); margin: 0 .45em; }
  .desc { display: block; margin-top: 2px; font-size: 15px; color: var(--ink-muted); }
  .more { padding: 0 var(--pad) 12px; }
  .more .btn { min-height: 40px; font-size: 15px; }
</style>
