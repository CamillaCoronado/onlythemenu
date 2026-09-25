<svelte:head><title>about · onlythemenu</title></svelte:head>

<main class="about">
  <a href="/" class="home">onlythemenu</a>
  <h1 class="display">about</h1>
  <p>onlythemenu shows a restaurant's menu with prices. no cart, no pickup time, no app, no account. we're the window, not the checkout — every menu links to the restaurant's own ordering page.</p>
  <h2 class="display">where menus come from</h2>
  <p>restaurant websites, owners, and diners who snap a photo. parsing is deterministic code, checked by a human when anything looks odd. every menu shows its source and when we last checked it.</p>
  <h2 class="display">takedowns</h2>
  <p>own a restaurant and want your menu changed or removed? email <a href="mailto:hello@onlythemenu.com">hello@onlythemenu.com</a>. we act within 48 hours.</p>
  <h2 class="display">privacy</h2>
  <p>no ads, no cookies, no tracking. analytics are cookieless and aggregate.</p>
  <h2 class="display">data</h2>
  <p>restaurant locations include data from <a href="https://overturemaps.org" rel="noopener">overture maps foundation</a> (cdla-permissive-2.0), which incorporates foursquare open source places (apache 2.0).</p>
</main>

<style>
  .about { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 32px; margin: 18px 0 8px; }
  h2 { font-size: 22px; margin: 22px 0 4px; }
</style>
