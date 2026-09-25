<script lang="ts">
  import { segments } from '$lib/find';
  let { text, q = '' }: { text: string; q?: string } = $props();
</script>

{#each segments(text, q) as s}{#if s.hit}<mark>{s.text}</mark>{:else}{s.text}{/if}{/each}

<style>
  mark { background: var(--mustard); color: var(--ink); border-radius: 3px; padding: 0 1px; }
</style>
