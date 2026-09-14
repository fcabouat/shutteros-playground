<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';

  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let { config, dispatch }: { config: GameConfig; dispatch: (intent: Intent) => void } = $props();
  let details = $state(false);
</script>

<article class="min-w-0 px-5 py-6 sm:px-6">
  <h2 class="text-xl leading-snug font-semibold tracking-tight">{copy.spoof.subject}</h2>
  <div class="mt-5 flex items-start gap-3">
    <span class="mail-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      ><Icon name="user" size={18} /></span
    >
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium">{copy.spoof.sender}</p>
      <p class="text-muted mt-1 text-xs">{copy.spoof.to}</p>
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
      <p class="mt-1 break-all font-mono text-sm">{config.mailLegitimateAddress}</p>
      <p class="text-muted mt-3 text-xs leading-relaxed">{copy.spoof.addressNote}</p>
    </div>
  {/if}
  <div class="mt-7 space-y-4 text-sm leading-[1.8]">
    <p>{copy.spoof.bodyStart}</p>
    <p>{copy.spoof.body}</p>
    <div
      class="document-request flex items-center gap-3 rounded-lg border border-[var(--line)] p-3"
    >
      <span class="file-badge"><Icon name="document" size={19} /></span>
      <span class="min-w-0">
        <span class="block truncate text-xs font-semibold">{copy.spoof.document}</span>
        <span class="text-muted mt-0.5 block text-[11px]">{copy.spoof.destination}</span>
      </span>
    </div>
    <p>{copy.spoof.bodyEnd}<br />{copy.spoof.signature}</p>
    <div class="mail-actions flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
      <button
        class="button button-soft"
        type="button"
        onclick={() => dispatch({ type: 'choose', choiceId: 'comply' })}
        ><Icon name="document" size={16} />{copy.spoof.comply}</button
      >
      <button
        class="button button-soft"
        type="button"
        onclick={() => dispatch({ type: 'choose', choiceId: 'reply' })}
        ><Icon name="mail" size={16} />{copy.spoof.reply}</button
      >
      <button
        class="button button-soft"
        type="button"
        data-hint-target="report"
        onclick={() => dispatch({ type: 'choose', choiceId: 'report' })}
        ><Icon name="shield" size={16} />{copy.spoof.reportToSupport}</button
      >
      <span class="text-muted text-xs">{config.supportLabel} · {config.supportContact}</span>
    </div>
  </div>
</article>

<style>
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
  .document-request {
    background: color-mix(in srgb, var(--soft) 55%, transparent);
  }
</style>
