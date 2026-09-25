<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  let { children } = $props();

  onMount(() => {
    // cookieless, loaded after hydration so it never competes with LCP
    if (!dev) import('@vercel/analytics').then((m) => m.inject({ mode: 'production' }));
    if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('/service-worker.js');
  });
</script>

<div class="col">{@render children()}</div>
