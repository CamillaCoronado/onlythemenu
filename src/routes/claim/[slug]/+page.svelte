<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>claim {data.r.name} · onlythemenu</title><meta name="robots" content="noindex" /></svelte:head>

<main class="pg">
  <a href="/owner" class="home">onlythemenu · owners</a>
  <h1 class="display">claim {data.r.name}</h1>
  <p class="muted">{data.r.address}</p>
  {#if data.claimedByMe}
    <p>it's yours. <a href="/owner/{data.r.id}">edit the menu</a></p>
  {:else if data.claimedByOther}
    <p>someone already manages this menu. wrong? email hello@onlythemenu.com.</p>
  {:else if form?.ok || data.pending}
    <p>got it, we'll check it. we call the restaurant's listed number to confirm, usually within 2 days.</p>
  {:else}
    <form method="post">
      <label>your role <input class="pop field" name="role" required placeholder="owner, manager…" /></label>
      <label>a phone we can reach you at <input class="pop field" name="phone" type="tel" required /></label>
      <label>anything that helps us verify (optional) <textarea class="pop field" name="proof" rows="3"></textarea></label>
      {#if form?.err}<p class="err" role="alert">{form.err}</p>{/if}
      <button class="pop btn mustard wide">send claim</button>
    </form>
  {/if}
</main>

<style>
  .pg { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 30px; margin: 18px 0 4px; }
  label { display: block; font-weight: 600; margin-top: 16px; }
  .field { display: block; width: 100%; margin-top: 6px; min-height: 48px; padding: 10px 12px; background: var(--mayo-deep); font: 600 17px var(--font-ui); color: var(--ink); }
  .wide { width: 100%; min-height: 52px; margin-top: 20px; }
  .err { color: var(--ketchup); font-weight: 600; }
</style>
