<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  let { open = $bindable(false), onConfirm }: { open?: boolean; onConfirm: () => void } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="exit-dialog" lang={i18n.locale}>
      <Icon name="power" size={28} />
      <Dialog.Title class="mt-4 text-2xl font-semibold">{copy.shell.exitTitle}</Dialog.Title>
      <Dialog.Description class="text-muted mt-3 text-sm leading-relaxed"
        >{copy.shell.exitBody}</Dialog.Description
      >
      <div class="mt-6 flex flex-wrap gap-3">
        <Dialog.Close class="button button-primary">{copy.shell.exitCancel}</Dialog.Close>
        <button class="button button-soft" type="button" onclick={onConfirm}
          >{copy.shell.exitConfirm}</button
        >
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.exit-dialog) {
    position: fixed;
    z-index: 50;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(540px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 28px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--window-shadow);
  }
</style>
