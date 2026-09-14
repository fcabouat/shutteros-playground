<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Icon from '../commons/Icon.svelte';
  let {
    step,
    infected,
    config,
    dispatch,
  }: {
    step: 'choose' | 'notify';
    infected: boolean;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
  } = $props();
</script>

<div
  class="incident-scene flex h-full flex-col justify-center p-6 sm:p-9"
  class:contained={step === 'notify'}
>
  <div class="mb-6 flex items-center gap-3">
    <span class="incident-symbol"
      ><Icon name={step === 'notify' ? 'wifiOff' : 'incident'} size={29} /></span
    >
    <div>
      <p class="text-sm font-semibold">{copy.incident.alert}</p>
      <p class="text-muted mt-1 text-xs">
        {step === 'notify' ? copy.incident.step2 : copy.incident.step1}
      </p>
    </div>
  </div>
  <h2 class="max-w-[390px] text-2xl leading-tight font-semibold tracking-tight">
    {step === 'notify' ? copy.incident.contained : copy.incident.title}
  </h2>
  {#if step === 'notify'}
    <p class="mt-3 max-w-[480px] text-sm font-semibold" role="status">
      {copy.incident.isolatedPrompt}
    </p>
  {/if}
  <p class="text-muted mt-4 max-w-[480px] text-sm leading-relaxed">
    {infected ? copy.incident.infected : copy.incident.exercise}
  </p>
  {#if step === 'choose'}
    <div class="incident-terminal mt-6 overflow-hidden rounded-xl p-5">
      <div class="mb-4 flex items-center gap-3">
        <Icon name="lock" size={17} /><span class="font-mono text-xs">{copy.incident.file}</span>
      </div>
      <div class="threat-progress mb-4 h-1 rounded-full" aria-hidden="true"><span></span></div>
      <p class="flex items-center gap-2 text-sm">
        <Icon name="network" size={17} />{copy.incident.spreading}
      </p>
    </div>
  {:else}
    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <section class="flex flex-col rounded-xl border border-[var(--line)] p-5">
        <h3 class="font-semibold">{copy.incident.alertContact}</h3>
        <p class="text-muted mt-2 mb-5 text-sm">{copy.incident.alertContactDetail}</p>
        <button
          class="button button-soft mt-auto self-start"
          onclick={() => dispatch({ type: 'choose', choiceId: 'call-number' })}
          >{copy.incident.callAction}</button
        >
      </section>
      <section class="flex flex-col rounded-xl border border-[var(--line)] p-5">
        <h3 class="font-semibold">{config.supportLabel}</h3>
        <p class="text-muted mt-2 mb-5 text-sm">{config.supportContact}</p>
        <button
          class="button button-soft mt-auto self-start"
          data-hint-target="report"
          onclick={() => dispatch({ type: 'choose', choiceId: 'notify' })}
          >{copy.incident.reportAction}</button
        >
      </section>
      <section class="flex flex-col rounded-xl border border-[var(--line)] p-5">
        <h3 class="font-semibold">{copy.incident.localFiles}</h3>
        <p class="text-muted mt-2 mb-5 text-sm">{copy.incident.file}</p>
        <button
          class="button button-soft mt-auto self-start"
          onclick={() => dispatch({ type: 'choose', choiceId: 'delete' })}
          >{copy.incident.deleteAction}</button
        >
      </section>
    </div>
  {/if}
</div>
