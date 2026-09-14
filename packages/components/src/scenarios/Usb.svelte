<script lang="ts">
  import { tick } from 'svelte';
  import { getI18n } from '../i18n/context';
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
  let selected = $state<0 | 1 | 2>(0);
  let editorOpen = $state(false);
  let editor = $state<HTMLElement>();
  let readmeButton = $state<HTMLButtonElement>();

  async function openItem(index: 0 | 1 | 2) {
    selected = index;
    if (index === 0) dispatch({ type: 'choose', choiceId: 'open' });
    else if (index === 1) dispatch({ type: 'choose', choiceId: 'archive' });
    else {
      editorOpen = true;
      await tick();
      editor?.focus({ preventScroll: true });
    }
  }

  async function closeEditor() {
    editorOpen = false;
    await tick();
    readmeButton?.focus({ preventScroll: true });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!editorOpen || event.key !== 'Escape') return;
    event.preventDefault();
    void closeEditor();
  }

  function ejectDrive() {
    dispatch({ type: 'choose', choiceId: 'eject' });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="usb-browser flex min-h-[300px] flex-col">
  <div
    class="browser-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2 text-sm"
  >
    <button class="file-toolbar-button" type="button" disabled aria-label={copy.usb.back}
      ><Icon name="back" size={16} /></button
    >
    <button class="file-toolbar-button" type="button" disabled aria-label={copy.usb.forward}
      ><Icon name="next" size={16} /></button
    >
    <span class="ml-2 flex min-w-0 items-center gap-2 truncate text-xs"
      ><Icon name="monitor" size={15} />{copy.usb.breadcrumb}<Icon name="next" size={13} /><strong
        class="truncate">{copy.usb.device}</strong
      ></span
    >
    <button
      class="button button-soft ml-auto text-xs"
      type="button"
      data-hint-target="eject"
      onclick={ejectDrive}><Icon name="drive" size={15} />{copy.usb.eject}</button
    >
    <button class="button button-soft text-xs" type="button" onclick={() => openItem(selected)}
      ><Icon name="external" size={15} />{copy.usb.openFile}</button
    >
  </div>
  <div class="grid min-h-0 flex-1 sm:grid-cols-[170px_1fr]">
    <aside class="file-sidebar hidden border-r border-[var(--line)] p-3 sm:block">
      <p class="text-muted mb-3 flex items-center gap-2 px-2 text-xs font-semibold">
        <Icon name="monitor" size={15} />{copy.usb.breadcrumb}
      </p>
      <div class="file-sidebar-item selected flex items-center gap-2 rounded-md px-2 py-2 text-xs">
        <Icon name="drive" size={16} /><span class="min-w-0 flex-1 truncate">{copy.usb.device}</span
        ><button
          class="file-sidebar-eject"
          type="button"
          data-hint-target="eject"
          aria-label={copy.usb.eject}
          title={copy.usb.eject}
          onclick={ejectDrive}><Icon name="external" size={14} /></button
        >
      </div>
      <p class="text-muted mt-5 px-2 text-[11px] font-semibold uppercase tracking-wide">
        {copy.usb.folders}
      </p>
      <div class="file-sidebar-item mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-xs">
        <Icon name="folder" size={15} />{copy.usb.documents}
      </div>
      <div class="file-sidebar-item flex items-center gap-2 rounded-md px-2 py-2 text-xs">
        <Icon name="folder" size={15} />{copy.usb.pictures}
      </div>
    </aside>
    <div class="min-w-0 overflow-auto p-3 sm:p-4">
      <div
        class="mb-3 flex items-center justify-between gap-3 border-b border-[var(--line)] px-2 pb-2"
      >
        <span class="truncate text-xs font-semibold">{copy.usb.device}</span><span
          class="text-muted shrink-0 text-[11px]">{copy.usb.capacity}</span
        >
      </div>
      <div class="file-list" role="group" aria-label={copy.usb.device}>
        <button
          id="usb-file-0"
          class="usb-file file-row flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left"
          class:selected={selected === 0}
          type="button"
          aria-pressed={selected === 0}
          aria-label={copy.usb.filename}
          title={copy.desktop.doubleClick}
          onclick={() => {
            selected = 0;
          }}
          ondblclick={() => openItem(0)}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              openItem(0);
            }
          }}
        >
          <span class="file-icon shrink-0"><Icon name="file" size={19} /></span><span
            class="min-w-0 flex-1 truncate text-xs font-medium">{copy.usb.filename}</span
          ><span class="text-muted hidden shrink-0 text-[11px] sm:inline">{copy.usb.kind}</span
          ><span class="text-muted hidden shrink-0 text-[11px] md:inline">{copy.usb.date}</span>
        </button>
        <button
          id="usb-file-1"
          class="file-row flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left"
          type="button"
          aria-pressed={selected === 1}
          class:selected={selected === 1}
          ondblclick={() => openItem(1)}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              openItem(1);
            }
          }}
          onclick={() => {
            selected = 1;
          }}
          ><span class="file-icon shrink-0"><Icon name="folder" size={19} /></span><span
            class="min-w-0 flex-1 truncate text-xs">{copy.usb.otherFile}</span
          ><span class="text-muted hidden text-[11px] sm:inline">{copy.usb.archive}</span></button
        >
        <button
          bind:this={readmeButton}
          id="usb-file-2"
          class="file-row flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left"
          type="button"
          aria-pressed={selected === 2}
          class:selected={selected === 2}
          ondblclick={() => openItem(2)}
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              openItem(2);
            }
          }}
          onclick={() => {
            selected = 2;
          }}
          ><span class="file-icon shrink-0"><Icon name="document" size={19} /></span><span
            class="min-w-0 flex-1 truncate text-xs">{copy.usb.readme}</span
          ><span class="text-muted hidden text-[11px] sm:inline">{copy.usb.textDocument}</span
          ></button
        >
      </div>
    </div>
  </div>
  {#if editorOpen}
    <div
      bind:this={editor}
      class="text-editor"
      role="dialog"
      aria-modal="false"
      aria-labelledby="usb-editor-title"
      tabindex="-1"
    >
      <div class="text-editor-titlebar">
        <div class="flex min-w-0 items-center gap-2">
          <Icon name="document" size={16} />
          <h2 id="usb-editor-title" class="truncate text-xs font-semibold">{copy.usb.readme}</h2>
        </div>
        <button
          class="icon-button shrink-0"
          type="button"
          aria-label={copy.usb.closePreview}
          onclick={() => void closeEditor()}><Icon name="close" size={15} /></button
        >
      </div>
      <div class="text-editor-menu" aria-hidden="true">{copy.usb.editorMenu}</div>
      <p class="text-editor-document">{copy.usb.readmePreview}</p>
      <div class="text-editor-status">{copy.usb.textDocument}</div>
    </div>
  {/if}
</div>

<style>
  .file-toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 27px;
    height: 27px;
    border-radius: 6px;
    color: var(--muted);
  }
  .file-toolbar-button:disabled {
    opacity: 0.38;
  }
  .file-sidebar-item {
    color: var(--muted);
  }
  .file-sidebar-item.selected {
    background: var(--soft);
    color: var(--ink);
  }
  .file-sidebar-eject {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 5px;
    color: var(--accent);
  }
  .file-sidebar-eject:hover,
  .file-sidebar-eject:focus-visible {
    background: var(--surface);
  }
  .file-row {
    min-height: 39px;
    color: var(--ink);
  }
  .file-row:hover,
  .file-row.selected {
    background: var(--soft);
    border-color: var(--line-strong, var(--line));
  }
  .file-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .file-icon {
    width: 24px;
    height: 26px;
    color: var(--accent);
  }
  .usb-browser {
    position: relative;
    isolation: isolate;
  }
  .text-editor {
    position: absolute;
    z-index: 5;
    top: clamp(48px, 16%, 82px);
    left: clamp(12px, 14%, 110px);
    width: min(430px, calc(100% - 24px));
    max-height: calc(100% - 64px);
    overflow: auto;
    border: 1px solid var(--line-strong, var(--line));
    border-radius: 9px;
    background: var(--surface);
    box-shadow: 0 18px 44px #1723304a;
  }
  .text-editor:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .text-editor-titlebar {
    display: flex;
    min-height: 38px;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid var(--line);
    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
    background: var(--soft);
  }
  .text-editor-menu {
    border-bottom: 1px solid var(--line);
    padding: 0.35rem 0.75rem;
    color: var(--muted);
    font-size: 0.6875rem;
  }
  .text-editor-document {
    min-height: 120px;
    margin: 0;
    padding: 1rem;
    white-space: pre-line;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.65;
  }
  .text-editor-status {
    border-top: 1px solid var(--line);
    padding: 0.3rem 0.75rem;
    color: var(--muted);
    font-size: 0.65rem;
    text-align: right;
  }
</style>
