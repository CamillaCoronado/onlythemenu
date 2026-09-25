<script lang="ts">
  import { starPoints } from './starburst';
  let { text, tone = 'mustard' }: { text: string; tone?: 'mustard' | 'ketchup' } = $props();
  const pts = starPoints(16, 100, 0.72, 0.06);
</script>

<div class="burst {tone}" role="status">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={pts} /></svg>
  <span>{text}</span>
</div>

<style>
  .burst {
    --tilt: -3deg;
    position: absolute; left: 50%; top: 50%;
    width: 150px; height: 84px; margin: -42px 0 0 -75px;
    display: grid; place-items: center;
    transform: rotate(var(--tilt));
    animation: slap var(--slap) both;
    filter: drop-shadow(3px 3px 0 var(--ink));
    pointer-events: none; z-index: 5;
  }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  polygon { stroke: var(--ink); stroke-width: 3; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .mustard polygon { fill: var(--mustard); }
  .ketchup polygon { fill: var(--ketchup); }
  span { position: relative; font: 400 20px/1 var(--font-display); }
  .mustard span { color: var(--ink); }
  .ketchup span { color: var(--mayo); }
</style>
