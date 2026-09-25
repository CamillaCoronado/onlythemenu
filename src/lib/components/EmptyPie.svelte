<script lang="ts">
  let { size = 180 }: { size?: number } = $props();
</script>

<svg width={size} height={size * 0.8} viewBox="0 0 200 160" aria-hidden="true" class="pie">
  <!-- fat pastel shadow -->
  <path d="M40 128 L170 104 L178 124 Q110 150 46 146 Z" fill="var(--ketchup-light)" transform="translate(10 10)" />
  <!-- crust wall + filling side -->
  <path d="M40 118 L170 94 L170 110 L40 136 Z" fill="var(--mustard)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
  <!-- top of slice -->
  <path d="M40 118 L170 94 Q168 60 132 42 Z" fill="var(--mustard-light)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
  <!-- back crust -->
  <path d="M132 42 Q168 60 170 94 L176 92 Q176 52 136 34 Z" fill="var(--mustard)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round" />
  <!-- vents -->
  <path d="M118 78 l14 -4 M104 92 l12 -3" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" />
  <!-- whipped dollop -->
  <circle cx="146" cy="70" r="9" fill="var(--mayo)" stroke="var(--ink)" stroke-width="3" />
</svg>

<style>
  .pie { display: block; margin: 0 auto; }
</style>
