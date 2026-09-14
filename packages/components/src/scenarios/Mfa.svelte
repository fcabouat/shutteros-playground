<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { Intent } from '@shutteros/core/model/game';
  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
  import Icon from '../commons/Icon.svelte';
</script>

<div class="mfa-scene flex h-full min-h-[450px] items-center justify-center p-6">
  <div class="mfa-device relative w-full max-w-[310px] rounded-[28px] p-6">
    <div class="mfa-notch mx-auto mb-6 h-1.5 w-14 rounded-full" aria-hidden="true"></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (phone details can overflow while the response buttons remain visible) -->
    <div class="mfa-details" role="group" aria-label={copy.mfa.request} tabindex="0">
      <div class="mb-5 flex items-center gap-2 text-xs">
        <Icon name="key" size={16} />{copy.mfa.app}
      </div>
      <span class="app-icon mb-5" data-app="mfa"><Icon name="key" size={26} /></span>
      <h2 class="text-2xl font-semibold tracking-tight">{copy.mfa.request}</h2>
      <p class="text-muted mt-3 text-sm leading-relaxed">{copy.mfa.subtitle}</p>
      <p class="mfa-code my-5 text-center text-5xl font-semibold tracking-[0.2em]">
        <span class="sr-only">{copy.mfa.codeLabel} : </span>{copy.mfa.code}
      </p>
      <dl class="space-y-3 text-xs">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{copy.mfa.location}</dt>
          <dd>{copy.mfa.city}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{copy.mfa.device}</dt>
          <dd>{copy.mfa.browser}</dd>
        </div>
      </dl>
      <p class="warning-note mt-5 rounded-lg p-3 text-xs leading-relaxed">{copy.mfa.repeated}</p>
    </div>
    <div class="mfa-actions mt-4 grid gap-2">
      {#each i18n.challenges.mfa.choices as choice (choice.id)}
        <button
          class="button button-soft justify-center"
          data-hint-target={choice.id}
          onclick={() => dispatch({ type: 'choose', choiceId: choice.id })}>{choice.label}</button
        >
      {/each}
    </div>
  </div>
</div>

<style>
  .mfa-details {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .mfa-actions {
    flex-shrink: 0;
  }

  @media (max-height: 800px) {
    .mfa-details > div:first-child {
      margin-bottom: 10px;
    }
    .mfa-details h2 {
      font-size: 1.25rem;
      line-height: 1.2;
    }
    .mfa-details > p:not(.mfa-code) {
      margin-top: 8px;
      font-size: 0.8125rem;
      line-height: 1.4;
    }
    .mfa-details .mfa-code {
      margin: 8px 0;
      font-size: 2rem;
      line-height: 1.2;
    }
    .mfa-details dl > div + div {
      margin-top: 6px;
    }
    .mfa-details .warning-note {
      padding: 8px;
    }
    .mfa-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }
    .mfa-actions .button {
      min-height: 36px;
      padding: 8px;
      font-size: 0.8125rem;
    }
    .mfa-actions .button:last-child {
      grid-column: 1 / -1;
    }
  }
</style>
