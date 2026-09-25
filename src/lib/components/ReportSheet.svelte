<script lang="ts">
  import type { Item } from '$lib/types';
  import { formatCents } from '$lib/price';
  import Sheet from './Sheet.svelte';

  let { open = $bindable(false), item, onsubmit }:
    { open?: boolean; item: Item | null; onsubmit: (cents: number, variant?: string) => Promise<boolean> } = $props();

  let digits = $state(''); // cents typed right-to-left, cash-register style
  let variant = $state<string | undefined>(undefined);
  let busy = $state(false);
  let err = $state('');

  $effect(() => {
    if (open) { digits = ''; err = ''; variant = item?.variants?.[0]?.label; }
  });

  const cents = $derived(digits ? parseInt(digits, 10) : 0);
  const current = $derived(
    item?.variants?.find((v) => v.label === variant)?.priceCents ?? item?.priceCents
  );

  function press(k: string) {
    if (k === '⌫') digits = digits.slice(0, -1);
    else if (digits.length < 6 && !(digits === '' && k === '0')) digits += k;
  }

  async function send() {
    if (cents < 50 || cents > 50000) { err = 'that price looks off'; return; }
    busy = true; err = '';
    const ok = await onsubmit(cents, variant);
    busy = false;
    if (!ok) err = "couldn't send that. try again?";
  }
</script>

<Sheet bind:open label="report a price">
  {#if item}
    <div class="body">
      <h2 class="display">what's it cost now?</h2>
      <p class="muted">{item.name}{#if current !== undefined} · was {formatCents(current)}{/if}</p>
      {#if item.variants?.length}
        <div class="vars" role="radiogroup" aria-label="size">
          {#each item.variants as v}
            <button class="pop chip" role="radio" aria-checked={variant === v.label} class:on={variant === v.label} onclick={() => (variant = v.label)}>{v.label}</button>
          {/each}
        </div>
      {/if}
      <output class="amt num" aria-live="polite">{formatCents(cents)}</output>
      <div class="pad">
        {#each ['1','2','3','4','5','6','7','8','9','00','0','⌫'] as k}
          <button class="pop key num" aria-label={k === '⌫' ? 'delete' : k}
            onclick={() => (k === '00' ? (press('0'), press('0')) : press(k))}>{k}</button>
        {/each}
      </div>
      {#if err}<p class="err" role="alert">{err}</p>{/if}
      <button class="pop btn mustard send" disabled={busy || !digits} onclick={send}>{busy ? 'sending…' : 'send it'}</button>
    </div>
  {/if}
</Sheet>

<style>
  .body { padding: 0 var(--pad); }
  h2 { font-size: 24px; }
  p { margin: 2px 0 10px; }
  .vars { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .chip { min-height: 44px; padding: 0 14px; font-weight: 600; cursor: pointer; }
  .chip.on { background: var(--mustard); }
  .amt { display: block; text-align: center; font-size: 40px; font-weight: 800; margin: 4px 0 12px; }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .key { min-height: 52px; font-size: 22px; font-weight: 800; cursor: pointer; background: var(--mayo); }
  .err { color: var(--ketchup); font-weight: 600; }
  .send { width: 100%; margin-top: 14px; min-height: 52px; font-size: 18px; }
  .send:disabled { opacity: .5; }
</style>
