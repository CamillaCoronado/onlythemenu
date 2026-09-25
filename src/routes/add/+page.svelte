<script lang="ts">
  import { page } from '$app/state';
  import Camera from 'lucide-svelte/icons/camera';
  import EmptyPie from '$lib/components/EmptyPie.svelte';
  import Burst from '$lib/components/Burst.svelte';

  const rid = $derived(page.url.searchParams.get('r') ?? '');
  let done = $state(page.url.searchParams.has('ok'));
  let busy = $state(false);
  let err = $state('');
  let fileName = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    busy = true; err = '';
    const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { accept: 'application/json' } }).catch(() => null);
    busy = false;
    if (res?.ok) { done = true; return; }
    err = (await res?.json().catch(() => null))?.message ?? "couldn't send that. try again?";
  }
</script>

<svelte:head><title>add a menu · onlythemenu</title></svelte:head>

<main class="add">
  <a href="/" class="home">onlythemenu</a>
  {#if done}
    <div class="done">
      <EmptyPie />
      <div class="burstwrap"><Burst text="GOT IT!" tone="ketchup" /></div>
      <h1 class="display">got it, we'll check it.</h1>
      <p><a href="/">back to search</a></p>
    </div>
  {:else}
    <h1 class="display">add a menu</h1>
    <p class="muted">paste the restaurant's menu link, or snap the paper menu. a human checks every one.</p>
    <form method="post" action="/api/submit" enctype="multipart/form-data" onsubmit={submit}>
      {#if rid}<input type="hidden" name="restaurantId" value={rid} />{/if}
      <label class="lbl" for="url">menu link</label>
      <input id="url" name="url" class="pop field" type="url" inputmode="url" placeholder="https://…" autocomplete="off" />
      <p class="or muted">or</p>
      <label class="pop btn mustard cam">
        <Camera size={22} strokeWidth={2.75} aria-hidden="true" />
        {fileName ? fileName : 'snap the menu'}
        <input class="sr-only" name="photo" type="file" accept="image/*" capture="environment"
          onchange={(e) => (fileName = e.currentTarget.files?.[0]?.name ?? '')} />
      </label>
      {#if err}<p class="err" role="alert">{err}</p>{/if}
      <button class="pop btn ketchup send" disabled={busy}>{busy ? 'sending…' : 'send it'}</button>
    </form>
  {/if}
</main>

<style>
  .add { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 32px; margin: 18px 0 8px; }
  .lbl { display: block; font-weight: 800; margin: 20px 0 8px; }
  .field { width: 100%; min-height: 56px; padding: 0 14px; background: var(--mayo-deep); font: 600 17px var(--font-ui); color: var(--ink); }
  .field:active { transform: none; box-shadow: var(--pop-shadow); }
  .or { text-align: center; margin: 14px 0; }
  .cam { width: 100%; min-height: 56px; font-size: 17px; }
  .cam:focus-within { outline: 3px solid var(--ketchup); outline-offset: 2px; }
  .send { width: 100%; margin-top: 22px; min-height: 56px; font-size: 18px; }
  .send:disabled { opacity: .5; }
  .err { color: var(--ketchup); font-weight: 600; }
  .done { text-align: center; padding-top: 30px; position: relative; }
  .burstwrap { position: relative; height: 0; top: -110px; }
  .done h1 { font-size: 26px; }
</style>
