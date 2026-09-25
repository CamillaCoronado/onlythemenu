<script lang="ts">
  let { data } = $props();
  const groups = $derived.by(() => {
    const g = new Map<string, typeof data.restaurants>();
    for (const r of data.restaurants) {
      const ch = r.name.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? '#';
      const k = /[A-Z]/.test(ch) ? ch : '#';
      g.set(k, [...(g.get(k) ?? []), r]);
    }
    return [...g.entries()];
  });
</script>

<svelte:head>
  <title>{data.cityName} menus with prices · onlythemenu</title>
  <meta name="description" content="menus with prices for {data.restaurants.length} restaurants in {data.cityName}. no cart, no app." />
</svelte:head>

<header class="hdr">
  <a href="/" class="home">onlythemenu</a>
  <h1 class="display">{data.cityName.toLowerCase()}</h1>
  <p>{data.restaurants.length} {data.restaurants.length === 1 ? 'restaurant' : 'restaurants'}, a–z</p>
</header>

<main>
  {#each groups as [letter, rows]}
    <section aria-labelledby="l-{letter}">
      <h2 id="l-{letter}" class="display letter">{letter}</h2>
      <ul>
        {#each rows as r}
          <li>
            <a href="/{data.citySlug}/{r.slug}">
              <span class="n">{r.name}</span>
              {#if r.cuisine.length}<span class="muted c">{r.cuisine.join(', ')}</span>{/if}
              {#if !r.hasMenu}<span class="muted c">· no menu yet</span>{/if}
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <p class="add muted">missing one? <a href="/add">add a menu</a></p>
</main>

<style>
  .hdr { position: relative; padding: calc(var(--safe-top) + 6px) var(--pad) 18px; background: var(--mustard); border-bottom: var(--line); }
  .hdr::before { content: ''; position: absolute; inset: 0; background: var(--dots); opacity: .15; -webkit-mask: linear-gradient(#000, transparent 85%); mask: linear-gradient(#000, transparent 85%); pointer-events: none; }
  .home { position: relative; display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { position: relative; font-size: clamp(34px, 10vw, 48px); margin-top: 10px; }
  .hdr p { position: relative; margin: 4px 0 0; font-weight: 600; }
  main { padding: 8px 0 40px; }
  .letter { position: sticky; top: 0; background: var(--mayo); padding: 8px var(--pad) 2px; font-size: 22px; border-bottom: 2px solid var(--ink); }
  ul { list-style: none; margin: 0; padding: 0; }
  a { text-decoration: none; }
  li a { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; min-height: 48px; padding: 12px var(--pad); }
  .n { font-weight: 600; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
  .c { font-size: 15px; }
  .add { padding: 20px var(--pad); }
  .add a { text-decoration: underline; }
</style>
