<script lang="ts">
  import { untrack } from 'svelte';
  import Burst from '$lib/components/Burst.svelte';
  let { data, form } = $props();
  // no js-enhance here: every submit is a full page load, so the initial value is the right one
  let text = $state(untrack(() => form?.text ?? data.text));
</script>

<svelte:head><title>edit {data.r.name} · onlythemenu</title><meta name="robots" content="noindex" /></svelte:head>

<main class="pg">
  <a href="/owner" class="home">← your menus</a>
  <h1 class="display">{data.r.name}</h1>
  <details class="help">
    <summary>how this works</summary>
    <pre>notes: applies to the whole menu
# Section title
> optional section note
Item name (V) .... $12.95
  one-line description
Sized item .... 6 oz $32.95 | 10 oz $39.95
Market item .... MKT</pre>
    <p class="muted">tags: (V) vegetarian, (VG) vegan, (GF) gluten-free.</p>
  </details>
  <form method="post">
    <label class="lbl" for="t">menu</label>
    <textarea id="t" name="text" class="pop ed" bind:value={text} spellcheck="false" rows="24"></textarea>
    <label class="lbl" for="o">your ordering link</label>
    <input id="o" name="orderUrl" class="pop field" type="url" value={data.r.orderUrl} placeholder="https://…" />
    {#if form?.errors}<ul class="err" role="alert">{#each form.errors as e}<li>{e}</li>{/each}</ul>{/if}
    <div class="save">
      <button class="pop btn mustard wide">publish</button>
      {#if form?.ok}<Burst text="LIVE!" tone="ketchup" />{/if}
    </div>
  </form>
  <p><a href="/{data.r.citySlug}/{data.r.slug}">view the menu page</a></p>
</main>

<style>
  .pg { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 30px; margin: 14px 0 8px; }
  .help summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
  pre { background: var(--mayo-deep); padding: 10px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
  .lbl { display: block; font-weight: 800; margin: 16px 0 6px; }
  .ed { width: 100%; padding: 12px; background: var(--mayo-deep); font: 400 15px/1.5 ui-monospace, Menlo, monospace; color: var(--ink); }
  .ed:active { transform: none; box-shadow: var(--pop-shadow); }
  .field { width: 100%; min-height: 48px; padding: 0 12px; background: var(--mayo-deep); font: 600 16px var(--font-ui); color: var(--ink); }
  .save { position: relative; }
  .wide { width: 100%; min-height: 52px; margin-top: 18px; }
  .err { color: var(--ketchup); font-weight: 600; }
</style>
