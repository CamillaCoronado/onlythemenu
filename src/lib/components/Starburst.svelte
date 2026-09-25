<script lang="ts">
  import { starPoints } from './starburst';
  import type { Freshness } from '$lib/freshness';

  let { fresh }: { fresh: Freshness } = $props();
  const outer = starPoints(14, 100, 0.8);
  const inner = starPoints(14, 100, 0.8);
</script>

<div class="starburst" role="img" aria-label={fresh.label}>
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <polygon points={outer} class="outer {fresh.tone}" />
    {#if fresh.tone === 'pickle'}
      <!-- pickle ring + light core keeps ink text at AA contrast -->
      <polygon points={inner} class="inner" transform="translate(12 12) scale(.76)" />
    {/if}
  </svg>
  <span class="txt" aria-hidden="true">
    {#each fresh.lines as l, i}<span class:big={i === 0}>{l}</span>{/each}
  </span>
</div>

<style>
  .starburst {
    --tilt: 6deg;
    position: relative;
    width: 108px; height: 108px;
    transform: rotate(var(--tilt));
    animation: slap var(--slap) both;
    filter: drop-shadow(3px 3px 0 var(--ink));
  }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  polygon { stroke: var(--ink); stroke-width: 3; stroke-linejoin: round; }
  .outer.pickle { fill: var(--pickle); }
  .outer.mustard { fill: var(--mustard-light); }
  .inner { fill: var(--pickle-light); stroke-width: 2.5; }
  .txt {
    position: absolute; inset: 24px 20px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
    font: 400 8.5px/1.05 var(--font-display);
    color: var(--ink);
    letter-spacing: .01em;
  }
  .big { font-size: 14px; line-height: 1.1; }
</style>
