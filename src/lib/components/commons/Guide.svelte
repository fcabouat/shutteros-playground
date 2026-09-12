<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { ChallengeId, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const challenges = $derived(i18n.challenges);
  const copy = $derived(i18n.text);
  import Icon from './Icon.svelte';
  let {
    open = $bindable(false),
    id,
    canNavigate,
    dispatch,
  }: {
    open?: boolean;
    id: ChallengeId | null;
    canNavigate: boolean;
    dispatch: (intent: Intent) => void;
  } = $props();
  let detailed = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger class="companion-trigger" aria-label={copy.shell.guide} title={copy.shell.guide}
    ><Icon name="sparkles" size={23} /></Dialog.Trigger
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
      <Dialog.Description class="text-muted mt-3 leading-relaxed"
        >{id ? challenges[id].hints[detailed ? 1 : 0] : copy.guide.complete}</Dialog.Description
      >
      <div class="mt-6 flex flex-wrap gap-3">
        {#if id && !detailed}<button class="button button-soft" onclick={() => (detailed = true)}
            >{copy.guide.nudge}<Icon name="light" size={17} /></button
          >{/if}
        {#if canNavigate && id}<button
            class="button button-primary"
            onclick={() => {
              open = false;
              dispatch({ type: 'open', id: id! });
            }}>{copy.guide.next}<Icon name="arrow" size={17} /></button
          >{/if}
        <Dialog.Close class="button button-text">{copy.guide.dismiss}</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
