<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
  let selected = $state(0);

  function openSelected() {
    dispatch({ type: 'choose', choiceId: 'open' });
  }
</script>

<div class="usb-browser flex min-h-[300px] flex-col" aria-label={copy.usb.device}>
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
    <button class="button button-soft ml-auto text-xs" type="button" onclick={openSelected}
      ><Icon name="external" size={15} />{copy.usb.openFile}</button
    >
  </div>
  <div class="grid min-h-0 flex-1 sm:grid-cols-[170px_1fr]">
    <aside class="file-sidebar hidden border-r border-[var(--line)] p-3 sm:block">
      <p class="text-muted mb-3 flex items-center gap-2 px-2 text-xs font-semibold">
        <Icon name="monitor" size={15} />{copy.usb.breadcrumb}
      </p>
      <div class="file-sidebar-item selected flex items-center gap-2 rounded-md px-2 py-2 text-xs">
        <Icon name="drive" size={16} />{copy.usb.device}
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
          aria-label={copy.usb.open}
          title={copy.desktop.doubleClick}
          onclick={() => (selected = 0)}
          ondblclick={openSelected}
          onkeydown={(event) => {
            if (event.key === 'Enter') openSelected();
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
          ondblclick={openSelected}
          onkeydown={(event) => {
            if (event.key === 'Enter') openSelected();
          }}
          onclick={() => (selected = 1)}
          ><span class="file-icon shrink-0"><Icon name="folder" size={19} /></span><span
            class="min-w-0 flex-1 truncate text-xs">{copy.usb.otherFile}</span
          ><span class="text-muted hidden text-[11px] sm:inline">{copy.usb.archive}</span></button
        >
        <button
          id="usb-file-2"
          class="file-row flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left"
          type="button"
          aria-pressed={selected === 2}
          class:selected={selected === 2}
          ondblclick={openSelected}
          onkeydown={(event) => {
            if (event.key === 'Enter') openSelected();
          }}
          onclick={() => (selected = 2)}
          ><span class="file-icon shrink-0"><Icon name="document" size={19} /></span><span
            class="min-w-0 flex-1 truncate text-xs">{copy.usb.readme}</span
          ><span class="text-muted hidden text-[11px] sm:inline">{copy.usb.textDocument}</span
          ></button
        >
      </div>
    </div>
  </div>
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
</style>
