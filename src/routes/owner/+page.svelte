<script lang="ts">
  let { data } = $props();
  async function out() { await fetch('/api/session', { method: 'DELETE' }); location.href = '/'; }
</script>

<svelte:head><title>your menus · onlythemenu</title><meta name="robots" content="noindex" /></svelte:head>

<main class="pg">
  <a href="/" class="home">onlythemenu</a>
  <h1 class="display">your menus</h1>
  {#if data.mine.length}
    <ul>{#each data.mine as r}<li><a class="pop row" href="/owner/{r.id}">{r.name}</a></li>{/each}</ul>
  {:else}
    <p class="muted">nothing claimed yet. find your restaurant's page and tap "claim" at the bottom, or go to /claim/&lt;city&gt;--&lt;slug&gt;.</p>
  {/if}
  <button class="link" onclick={out}>sign out</button>
</main>

<style>
  .pg { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 30px; margin: 18px 0 12px; }
  ul { list-style: none; padding: 0; display: grid; gap: 10px; }
  .row { display: flex; align-items: center; min-height: 52px; padding: 0 14px; font-weight: 800; text-decoration: none; }
  .link { margin-top: 30px; background: none; border: 0; text-decoration: underline; min-height: 44px; cursor: pointer; }
</style>
