<script lang="ts">
  import { formatCents } from '$lib/price';
  let { data, form } = $props();
  const ADAPTERS = ['jsonld', 'html', 'pdf', 'image'];
</script>

<svelte:head><title>review · onlythemenu</title><meta name="robots" content="noindex" /></svelte:head>

<main class="adm">
  <h1 class="display">review queue</h1>
  {#if form?.ok}<p class="ok" role="status">{form.ok}</p>{/if}
  {#if form?.err}<p class="err" role="alert">{form.err}</p>{/if}

  <h2 class="display">parsed menus ({data.queue.length})</h2>
  {#each data.queue as q (q.id)}
    <article class="pop card">
      <header><strong>{q.id}</strong> · {q.sourceType} · <a href={q.sourceUrl} rel="noopener noreferrer">source</a></header>
      <ul class="fails">{#each q.failures as f}<li>{f}</li>{/each}</ul>
      <div class="split">
        <div class="raw">
          {#if !q.raw}<p class="muted">no raw snapshot</p>
          {:else if ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(q.rawKind ?? '')}<img src={q.raw} alt="raw source" />
          {:else}<iframe src={q.raw} title="raw source" sandbox=""></iframe>{/if}
        </div>
        <form method="post" action="?/approve" class="parsed">
          <input type="hidden" name="id" value={q.id} />
          <textarea name="text" rows="28" spellcheck="false">{q.text}</textarea>
          <div class="acts">
            <button class="pop btn mustard">approve (with any edits)</button>
            <button class="pop btn" formaction="?/reject">reject</button>
          </div>
        </form>
      </div>
      <form method="post" action="?/pin" class="pin">
        <input type="hidden" name="id" value={q.id} />
        <label>pin adapter <select name="adapter">{#each ADAPTERS as a}<option>{a}</option>{/each}</select></label>
        <button class="pop btn">pin + re-run</button>
      </form>
    </article>
  {:else}<p class="muted">nothing waiting.</p>{/each}

  <h2 class="display">price reports ({data.reports.length})</h2>
  {#each data.reports as g (g.key)}
    <article class="pop card">
      <header><strong>{g.itemName}</strong>{#if g.variantLabel} ({g.variantLabel}){/if} · {g.restaurantId}</header>
      {#each Object.entries(g.prices) as [cents, n]}
        <form method="post" action="?/report" class="rep">
          {#each Object.entries({ ids: g.ids.join(','), cents, restaurantId: g.restaurantId, sectionIdx: g.sectionIdx, itemIdx: g.itemIdx, itemName: g.itemName, variantLabel: g.variantLabel ?? '' }) as [k, v]}<input type="hidden" name={k} value={v} />{/each}
          <span class="num">{formatCents(Number(cents))} × {n}</span>
          <button class="pop btn mustard" name="verdict" value="apply">apply</button>
          <button class="pop btn" name="verdict" value="dismiss">dismiss all</button>
        </form>
      {/each}
    </article>
  {:else}<p class="muted">no open reports.</p>{/each}

  <h2 class="display">owner claims ({data.claims.length})</h2>
  {#each data.claims as c (c.id)}
    <form method="post" action="?/claim" class="pop card">
      <input type="hidden" name="id" value={c.id} />
      <p><strong>{c.restaurantId}</strong> · {c.role} · <a href="tel:{c.phone}">{c.phone}</a></p>
      {#if c.proof}<p class="muted">{c.proof}</p>{/if}
      <p class="muted">verify by calling the restaurant's listed number, not the one above.</p>
      <button class="pop btn mustard" name="verdict" value="approve">approve</button>
      <button class="pop btn" name="verdict" value="reject">reject</button>
    </form>
  {:else}<p class="muted">no claims.</p>{/each}

  <h2 class="display">submissions ({data.submissions.length})</h2>
  {#each data.submissions as s (s.id)}
    <form method="post" action="?/submission" class="pop card">
      <input type="hidden" name="id" value={s.id} />
      <p>{s.restaurantId ?? 'no restaurant'} {#if s.url}· <a href={s.url} rel="noopener noreferrer nofollow">{s.url}</a>{/if}</p>
      {#if s.photo}<img src={s.photo} alt="submitted menu" class="thumb" />{/if}
      <button class="pop btn mustard" name="verdict" value="done">done</button>
      <button class="pop btn" name="verdict" value="reject">reject</button>
    </form>
  {:else}<p class="muted">no submissions.</p>{/each}
</main>

<style>
  .adm { padding: 16px var(--pad) 60px; }
  :global(.col:has(.adm)) { max-width: 1280px; }
  h1 { font-size: 32px; }
  h2 { font-size: 22px; margin: 28px 0 10px; }
  .card { display: block; padding: 14px; margin-bottom: 16px; }
  .card:active { transform: none; box-shadow: var(--pop-shadow); }
  .fails { color: var(--ketchup); font-weight: 600; margin: 8px 0; }
  .split { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 900px) { .split { grid-template-columns: 1fr 1fr; } }
  .raw iframe, .raw img { width: 100%; height: 640px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; object-fit: contain; }
  textarea { width: 100%; font: 13px/1.45 ui-monospace, Menlo, monospace; padding: 10px; background: var(--mayo-deep); border: 2px solid var(--ink); border-radius: 8px; color: var(--ink); }
  .acts, .rep, .pin { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
  select { min-height: 44px; }
  .thumb { max-width: 320px; display: block; margin: 8px 0; border: 2px solid var(--ink); border-radius: 8px; }
  .ok { display: inline-block; padding: 4px 10px; background: var(--pickle-light); border-radius: 6px; font-weight: 800; }
  .err { color: var(--ketchup); font-weight: 600; }
</style>
