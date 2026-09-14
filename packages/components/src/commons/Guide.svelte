<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import Icon from './Icon.svelte';
  let {
    open = $bindable(false),
    destination,
    canNavigate,
    remaining,
    onNavigate,
  }: {
    open?: boolean;
    destination: string | null;
    canNavigate: boolean;
    remaining: number;
    onNavigate: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger class="companion-trigger" aria-label={copy.guide.prompt} title={copy.guide.prompt}
    ><Icon name="sparkles" size={23} /><span>{copy.guide.prompt}</span></Dialog.Trigger
  >
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="guide-dialog" lang={i18n.locale}>
      <div class="mb-5 flex items-center justify-between gap-4">
        <span class="guide-spark"><Icon name="sparkles" size={26} /></span><Dialog.Close
          class="icon-button"
          aria-label={copy.shell.close}><Icon name="close" /></Dialog.Close
        >
      </div>
      <Dialog.Title class="text-xl font-semibold tracking-tight">{copy.guide.name}</Dialog.Title>
      {#if remaining > 0}
        <p class="mt-3 font-medium">
          {remaining === 1
            ? copy.guide.remainingOne
            : copy.guide.remainingMany.replace('{count}', String(remaining))}
        </p>
      {/if}
      <Dialog.Description class="text-muted mt-3 leading-relaxed"
        >{destination
          ? copy.guide.destination.replace('{activity}', destination)
          : copy.guide.complete}</Dialog.Description
      >
      <div class="mt-6 flex flex-wrap gap-3">
        {#if canNavigate && destination}<button
            class="button button-primary"
            onclick={() => {
              open = false;
              onNavigate();
            }}>{copy.guide.next}<Icon name="arrow" size={17} /></button
          >{/if}
        <Dialog.Close class="button button-text">{copy.guide.dismiss}</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
