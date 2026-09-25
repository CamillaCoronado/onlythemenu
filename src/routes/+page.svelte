<script lang="ts">
  import { onMount } from 'svelte';
  import WordmarkGrid from '$lib/components/WordmarkGrid.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import { getRecent, type Recent } from '$lib/recent';

  let recent = $state<Recent[]>([]);
  onMount(() => (recent = getRecent().slice(0, 8)));
</script>

<svelte:head>
  <title>onlythemenu — you just wanted to see the menu.</title>
  <meta name="description" content="restaurant menus with prices. no cart. no pickup time. no app. just prices." />
</svelte:head>

<main class="home">
  <WordmarkGrid />
  <p class="hero display">you just wanted to see the menu.</p>
  <SearchBar />
  <p class="line muted">no cart. no pickup time. no app. just prices.</p>
  {#if recent.length}
    <nav aria-label="recent menus" class="recent">
      <h2 class="sr-only">recent menus</h2>
      <ul>{#each recent as r}<li><a href={r.href}>{r.name}</a> <span class="muted">· {r.city}</span></li>{/each}</ul>
    </nav>
  {/if}
  <footer class="foot muted"><a href="/add">add a menu</a> · <a href="/about">about</a></footer>
</main>

<style>
  .home { padding: calc(var(--safe-top) + 20px) var(--pad) 40px; }
  .hero { margin: 26px 0 16px; font-size: 24px; line-height: 1.15; }
  .line { margin: 18px 2px 0; font-size: 15px; }
  .recent ul { list-style: none; margin: 18px 0 0; padding: 0; }
  .recent li { font-size: 16px; }
  .recent a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
  .foot { margin-top: 40px; font-size: 15px; }
  .foot a { display: inline-flex; align-items: center; min-height: 44px; }
</style>
