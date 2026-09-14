<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Icon from '../commons/Icon.svelte';
  import Spoof from './Spoof.svelte';

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let {
    snapshot,
    config,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
  } = $props();
  let details = $state(false);
  const activeId = $derived(
    snapshot.scene.kind === 'challenge' && snapshot.scene.id === 'spoof' ? 'spoof' : 'mail',
  );

  function openMessage(id: 'mail' | 'spoof') {
    if (id !== activeId) dispatch({ type: 'open', id });
  }

  function hasResult(id: 'mail' | 'spoof') {
    return snapshot.results.some((result) => result.id === id);
  }
</script>

<div class="mail-scene grid sm:grid-cols-[190px_1fr]">
  <aside class="mail-list border-b border-[var(--line)] sm:border-r sm:border-b-0">
    <div class="px-4 py-3 sm:py-4">
      <p class="flex items-center gap-2 text-sm font-semibold">
        <Icon name="mail" size={17} />{copy.mail.inbox}
      </p>
      <p class="text-muted mt-1 text-xs">{copy.mail.unread}</p>
    </div>
    <div class="mail-list-messages grid grid-cols-2 sm:block">
      <button
        class="mail-list-message w-full border-t border-[var(--line)] px-4 py-3 text-left sm:py-4"
        class:active={activeId === 'mail'}
        type="button"
        aria-current={activeId === 'mail' ? 'page' : undefined}
        title={hasResult('mail') ? copy.mail.replay : undefined}
        disabled={snapshot.mode === 'guided' && activeId !== 'mail'}
        onclick={() => openMessage('mail')}
      >
        <span class="block truncate text-xs font-semibold">{copy.mail.sender}</span>
        <span class="mt-1 block text-xs leading-relaxed sm:mt-2">{copy.mail.subject}</span>
        <span class="text-muted mt-1 block text-[11px] sm:mt-2">{copy.mail.date}</span>
        {#if hasResult('mail')}
          <span class="message-result mt-2 flex items-center gap-1 text-[11px] font-medium"
            ><Icon name="check" size={13} />{copy.mail.completed}</span
          >
        {/if}
      </button>
      <button
        class="mail-list-message w-full border-t border-l border-[var(--line)] px-4 py-3 text-left sm:border-l-0 sm:py-4"
        class:active={activeId === 'spoof'}
        type="button"
        aria-current={activeId === 'spoof' ? 'page' : undefined}
        title={hasResult('spoof') ? copy.mail.replay : undefined}
        disabled={snapshot.mode === 'guided' && activeId !== 'spoof'}
        onclick={() => openMessage('spoof')}
      >
        <span class="block truncate text-xs font-semibold">{copy.spoof.sender}</span>
        <span class="mt-1 block text-xs leading-relaxed sm:mt-2">{copy.spoof.subject}</span>
        <span class="text-muted mt-1 block text-[11px] sm:mt-2">{copy.spoof.date}</span>
        {#if hasResult('spoof')}
          <span class="message-result mt-2 flex items-center gap-1 text-[11px] font-medium"
            ><Icon name="check" size={13} />{copy.mail.completed}</span
          >
        {/if}
      </button>
    </div>
  </aside>

  {#if activeId === 'spoof'}
    <Spoof {config} {dispatch} />
  {:else}
    <article class="min-w-0 px-5 py-6 sm:px-6">
      <h2 class="text-xl leading-snug font-semibold tracking-tight">{copy.mail.subject}</h2>
      <div class="mt-5 flex items-start gap-3">
        <span class="mail-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          ><Icon name="user" size={18} /></span
        >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">{copy.mail.sender}</p>
          <p class="text-muted mt-1 text-xs">{copy.mail.to}</p>
          <button
            class="text-link mt-2 flex items-center gap-1 text-xs"
            type="button"
            onclick={() => (details = !details)}
            aria-expanded={details}>{copy.mail.details}<Icon name="down" size={13} /></button
          >
        </div>
      </div>
      {#if details}
        <div class="mail-details mt-4 rounded-lg p-3">
          <p class="text-xs font-semibold">{copy.mail.actualAddress}</p>
          <p class="mt-1 break-all font-mono text-sm">{config.mailImpersonatorAddress}</p>
          <p class="text-muted mt-3 text-xs leading-relaxed">{copy.mail.noSignature}</p>
        </div>
      {/if}
      <div class="mt-7 space-y-4 text-sm leading-[1.8]">
        <p>{copy.mail.bodyStart}</p>
        <p>{copy.mail.body}</p>
        <button
          class="mail-attachment flex w-full items-center gap-3 rounded-lg border border-[var(--line)] p-3 text-left"
          type="button"
          onclick={() => dispatch({ type: 'choose', choiceId: 'open' })}
        >
          <span class="file-badge"><Icon name="document" size={19} /></span>
          <span class="min-w-0">
            <span class="block truncate text-xs font-semibold">{copy.mail.attachment}</span>
            <span class="text-muted mt-0.5 block text-[11px]">{copy.mail.attachmentType}</span>
          </span>
        </button>
        <p>{copy.mail.bodyEnd}<br />{copy.mail.signature}</p>
        <div
          class="mail-actions flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4"
        >
          <button
            class="button button-soft"
            type="button"
            onclick={() => dispatch({ type: 'choose', choiceId: 'reply' })}
            ><Icon name="mail" size={16} />{copy.mail.reply}</button
          >
          <button
            class="button button-soft"
            type="button"
            data-hint-target="report"
            onclick={() => dispatch({ type: 'choose', choiceId: 'report' })}
            ><Icon name="shield" size={16} />{copy.mail.reportToSupport}</button
          >
          <span class="text-muted text-xs">{config.supportLabel} · {config.supportContact}</span>
        </div>
      </div>
    </article>
  {/if}
</div>

<style>
  .mail-scene {
    min-height: 350px;
  }
  .mail-list {
    background: color-mix(in srgb, var(--soft) 45%, var(--surface));
  }
  .mail-list-message {
    color: var(--ink);
  }
  .mail-list-message:hover:not(:disabled),
  .mail-list-message.active {
    background: var(--surface);
  }
  .mail-list-message.active {
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .mail-list-message:disabled {
    opacity: 0.52;
  }
  .message-result {
    color: var(--accent);
  }
  .mail-avatar,
  .file-badge {
    background: var(--soft);
    color: var(--accent);
  }
  .file-badge {
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
  }
  .mail-details {
    border: 1px solid var(--line);
    background: var(--soft);
  }
  .mail-attachment:hover,
  .mail-attachment:focus-visible {
    border-color: var(--accent);
    background: var(--soft);
  }
</style>
