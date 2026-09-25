<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(false), label, children }: { open?: boolean; label: string; children: Snippet } = $props();
  let dlg: HTMLDialogElement;

  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} aria-label={label} onclose={() => (open = false)}
  onclick={(e) => { if (e.target === dlg) open = false; }}>
  <div class="sheet">
    <div class="grab" aria-hidden="true"></div>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    margin: auto auto 0; padding: 0; border: 0; background: none;
    width: 100%; max-width: var(--col); max-height: 80dvh;
    overflow: visible;
  }
  dialog::backdrop { background: rgb(43 27 23 / .35); }
  dialog[open] .sheet { animation: sheet-up 220ms ease-out; }
  .sheet {
    background: var(--mayo-deep);
    border: var(--line); border-bottom: 0;
    border-radius: var(--r) var(--r) 0 0;
    box-shadow: 0 -4px 0 var(--ink);
    padding: 8px 0 calc(16px + env(safe-area-inset-bottom, 0px));
    max-height: 80dvh; overflow-y: auto; overscroll-behavior: contain;
  }
  .grab { width: 44px; height: 5px; margin: 0 auto 8px; border-radius: 3px; background: var(--ink); opacity: .35; }
</style>
