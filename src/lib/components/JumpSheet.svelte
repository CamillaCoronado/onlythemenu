<script lang="ts">
  import type { Section } from '$lib/types';
  import Sheet from './Sheet.svelte';
  let { open = $bindable(false), sections, current = 0, onpick }:
    { open?: boolean; sections: Section[]; current?: number; onpick: (i: number) => void } = $props();
</script>

<Sheet bind:open label="jump to section">
  <h2 class="display hd">sections</h2>
  <ul>
    {#each sections as s, i}
      <li>
        <button class:cur={i === current} onclick={() => onpick(i)} aria-current={i === current ? 'true' : undefined}>
          <span class="t">{s.title}</span><span class="n num">{s.items.length}</span>
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .hd { font-size: 22px; padding: 0 var(--pad) 6px; }
  ul { list-style: none; margin: 0; padding: 0; }
  button {
    display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px;
    padding: 0 var(--pad); background: none; border: 0; text-align: left; cursor: pointer;
    font-weight: 600; font-size: 17px;
  }
  button.cur { background: var(--mustard-light); }
  .t { flex: 1; }
  .n { color: var(--ink-muted); font-weight: 800; }
</style>
