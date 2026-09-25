<script lang="ts">
  import { page } from '$app/state';
  import EmptyPie from '$lib/components/EmptyPie.svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'not found' : 'oops'} · onlythemenu</title></svelte:head>

<main class="err">
  <a href="/" class="home">onlythemenu</a>
  <EmptyPie />
  {#if page.status === 404}
    <h1 class="display">we don't know that one yet</h1>
    <p><a class="pop btn mustard" href="/add">add a menu</a></p>
  {:else}
    <h1 class="display">something broke</h1>
    <p class="muted">{page.error?.message}</p>
  {/if}
</main>

<style>
  .err { padding: 24px var(--pad); text-align: center; }
  .home { display: inline-block; font-weight: 800; margin-bottom: 32px; min-height: 44px; }
  h1 { font-size: 28px; margin: 18px 0 16px; }
</style>
