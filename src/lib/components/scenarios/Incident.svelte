<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Icon from '../commons/Icon.svelte';
  let {
    step,
    infected,
    config,
  }: { step: 'choose' | 'notify'; infected: boolean; config: GameConfig } = $props();
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
  <div class="incident-terminal mt-6 overflow-hidden rounded-xl p-5">
    {#if step === 'choose'}<div class="mb-4 flex items-center gap-3">
        <Icon name="lock" size={17} /><span class="font-mono text-xs">{copy.incident.file}</span>
      </div>
      <div class="threat-progress mb-4 h-1 rounded-full" aria-hidden="true"><span></span></div>
      <p class="flex items-center gap-2 text-sm">
        <Icon name="network" size={17} />{copy.incident.spreading}
      </p>
    {:else}<p class="eyebrow mb-3">{copy.incident.support}</p>
      <p class="font-medium">{config.supportLabel}</p>
      <p class="mt-2 text-sm opacity-80">{config.supportContact}</p>{/if}
  </div>
</div>
