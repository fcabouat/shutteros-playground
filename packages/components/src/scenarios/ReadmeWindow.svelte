<script lang="ts">
  import { getI18n } from '../i18n/context';
  import FloatingWindow from '../commons/FloatingWindow.svelte';
  import Icon from '../commons/Icon.svelte';
  let {
    isHidden = false,
    onMinimize,
    onClose,
  }: { isHidden?: boolean; onMinimize: () => void; onClose: () => void } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<FloatingWindow
  kind="readme"
  title={copy.usb.readme}
  icon="document"
  {isHidden}
  {onMinimize}
  {onClose}
  closeLabel={copy.usb.closePreview}
>
  <div class="text-editor-menu" aria-hidden="true">{copy.usb.editorMenu}</div>
  <p class="text-editor-document">{copy.usb.readmePreview}</p>
  <div class="readme-advisory" role="note">
    <Icon name="incident" size={18} />
    <div>
      <strong>{copy.usb.readmeAdvisoryTitle}</strong>
      <p>{copy.usb.readmeAdvisory}</p>
    </div>
  </div>
  <div class="text-editor-status">{copy.usb.textDocument}</div>
</FloatingWindow>

<style>
  .text-editor-menu {
    border-bottom: 1px solid var(--line);
    padding: 0.35rem 0.75rem;
    color: var(--muted);
    font-size: 0.6875rem;
  }
  .text-editor-document {
    margin: 0;
    padding: 1rem;
    white-space: pre-line;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.65;
  }
  .readme-advisory {
    display: flex;
    gap: 0.65rem;
    margin: 0 0.75rem 0.75rem;
    border: 1px solid #d7a05c;
    border-radius: 7px;
    padding: 0.7rem 0.75rem;
    background: var(--warning-soft);
    color: var(--warning);
    font-size: 0.72rem;
    line-height: 1.45;
  }
  .readme-advisory :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }
  .readme-advisory p {
    margin: 0.2rem 0 0;
  }
  .text-editor-status {
    border-top: 1px solid var(--line);
    padding: 0.3rem 0.75rem;
    color: var(--muted);
    font-size: 0.65rem;
    text-align: right;
  }
</style>
