<script lang="ts">
  import type { Section } from '$lib/types';
  import { itemMatches } from '$lib/find';
  import MenuItem from './MenuItem.svelte';
  import StickySectionTitle from './StickySectionTitle.svelte';

  let {
    section, idx, q = '', thanksKey = '', onjump, onfind, onreport
  }: {
    section: Section; idx: number; q?: string; thanksKey?: string;
    onjump: () => void; onfind: () => void; onreport: (itemIdx: number) => void;
  } = $props();
</script>

<section id="s{idx}" data-idx={idx} aria-labelledby="h{idx}">
  <StickySectionTitle title={section.title} id="h{idx}" {onjump} {onfind} />
  {#if section.note}<p class="note">{section.note}</p>{/if}
  <ul>
    {#each section.items as item, i}
      <MenuItem {item} {q} dim={!!q && !itemMatches(item, q)} thanks={thanksKey === `${idx}:${i}`} onreport={() => onreport(i)} />
    {/each}
  </ul>
</section>

<style>
  section { padding-bottom: 18px; }
  .note { margin: 2px var(--pad) 6px; font-size: 15px; color: var(--ink-muted); }
  ul { margin: 0; padding: 0; }
</style>
