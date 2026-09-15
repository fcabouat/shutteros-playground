<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { getI18n } from '../i18n/context';
  import WindowFrame from './WindowFrame.svelte';

  let {
    kind,
    title,
    icon,
    isHidden = false,
    onMinimize,
    onClose,
    closeLabel,
    minimizeLabel,
    focusOnShow = true,
    children,
  }: {
    kind: 'readme' | 'hint';
    title: string;
    icon: 'document' | 'light';
    isHidden?: boolean;
    onMinimize: () => void;
    onClose?: () => void;
    closeLabel?: string;
    minimizeLabel?: string;
    focusOnShow?: boolean;
    children: Snippet;
  } = $props();
  const i18n = getI18n();
  let dialog: HTMLDivElement;
  $effect(() => {
    if (!isHidden && focusOnShow)
      void tick().then(() => {
        if (!isHidden && dialog?.isConnected) dialog.focus({ preventScroll: true });
      });
  });
</script>

<div
  bind:this={dialog}
  class="floating-window-layer view-host"
  class:readme-window-layer={kind === 'readme'}
  class:hint-window-layer={kind === 'hint'}
  role="dialog"
  aria-modal="false"
  aria-label={title}
  tabindex="-1"
  hidden={isHidden}
  inert={isHidden}
  onkeydown={(event) => {
    if (!isHidden && event.key === 'Escape' && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }}
>
  <WindowFrame
    resizable={false}
    {title}
    {icon}
    {onMinimize}
    {onClose}
    {closeLabel}
    {minimizeLabel}
    moveLabel={i18n.text.experience.move}
    moveHint={i18n.text.experience.moveHint}
  >
    {@render children()}
  </WindowFrame>
</div>

<style>
  .floating-window-layer {
    position: absolute;
    inset: 12px;
    width: auto;
    height: auto;
    z-index: 20;
    pointer-events: none;
    outline: none;
  }
  .floating-window-layer :global(.os-window) {
    width: min(560px, 100%);
  }
  .hint-window-layer {
    align-items: flex-start;
    justify-content: flex-end;
    z-index: 30;
  }
  .hint-window-layer :global(.os-window) {
    width: min(420px, 100%);
  }
</style>
