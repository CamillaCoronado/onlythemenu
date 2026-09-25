<script lang="ts">
  import { ariaCents, formatCents } from '$lib/price';
  let { cents }: { cents: number } = $props();
</script>

<span class="price num"><span aria-hidden="true">{formatCents(cents)}</span><span class="sr-only">{ariaCents(cents)}</span></span>

<style>
  .price { font-weight: 800; white-space: nowrap; }
</style>
