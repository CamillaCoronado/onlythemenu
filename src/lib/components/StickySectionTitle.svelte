<script lang="ts">
  import Search from 'lucide-svelte/icons/search';
  let { title, id, onjump, onfind }: { title: string; id: string; onjump: () => void; onfind: () => void } = $props();
</script>

<!-- position:sticky inside its <section>: the next section's title pushes this one off -->
<div class="sticky">
  <h2 {id} class="display"><button class="title" onclick={onjump} aria-haspopup="dialog">{title}</button></h2>
  <button class="icon-btn" onclick={onfind} aria-label="find in menu"><Search size={22} strokeWidth={2.75} /></button>
</div>

<style>
  .sticky {
    position: sticky; top: var(--stick-top, 0px); z-index: 3;
    display: flex; align-items: center; gap: 4px;
    padding: calc(var(--safe-top) * var(--safe-mul, 1)) 6px 0 var(--pad);
    background: var(--mayo);
    border-bottom: 2px solid var(--ink);
  }
  h2 { flex: 1; min-width: 0; font-size: 26px; line-height: 1.1; }
  .title {
    display: block; width: 100%; min-height: 52px; padding: 8px 0;
    background: none; border: 0; text-align: left; cursor: pointer;
    font: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
</style>
