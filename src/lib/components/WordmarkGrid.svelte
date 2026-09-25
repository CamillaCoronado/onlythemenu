<script lang="ts">
  const tiles = [
    { bg: 'var(--ketchup)', fg: 'var(--mayo)' },
    { bg: 'var(--mustard)', fg: 'var(--ink)' },
    { bg: 'var(--pickle)', fg: 'var(--ink)' },
    { bg: 'var(--ink)', fg: 'var(--mustard)' }
  ];
</script>

<div class="grid">
  {#each tiles as t, i}
    <div class="tile" style:background={t.bg} style:color={t.fg} aria-hidden={i > 0 ? 'true' : undefined}>
      {#if i === 0}<h1 class="wm">onlythemenu</h1>{:else}<span class="wm">onlythemenu</span>{/if}
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border: var(--line); border-radius: var(--r); overflow: hidden;
    box-shadow: var(--pop-shadow);
  }
  .tile {
    aspect-ratio: 1.6;
    display: grid; place-items: center;
  }
  .tile:nth-child(1), .tile:nth-child(2) { border-bottom: var(--line); }
  .tile:nth-child(odd) { border-right: var(--line); }
  .wm { font: 400 clamp(20px, 6.4vw, 38px)/1 var(--font-display); letter-spacing: -.01em; }
  @media (max-width: 359px) {
    .grid { grid-template-columns: 1fr; }
    .tile { aspect-ratio: auto; padding: 14px 0; border-right: 0 !important; border-bottom: var(--line); }
    .tile:last-child { border-bottom: 0; }
    .wm { font-size: 30px; }
  }
</style>
