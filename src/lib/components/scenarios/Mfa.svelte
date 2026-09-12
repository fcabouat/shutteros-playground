<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import Icon from '../commons/Icon.svelte';
</script>

<div class="mfa-scene flex h-full min-h-[450px] items-center justify-center p-6">
  <div class="mfa-device relative w-full max-w-[310px] rounded-[28px] p-6">
    <div class="mfa-notch mx-auto mb-6 h-1.5 w-14 rounded-full" aria-hidden="true"></div>
    <div class="mb-5 flex items-center gap-2 text-xs">
      <Icon name="key" size={16} />{copy.mfa.app}
    </div>
    <span class="app-icon mb-5" data-app="mfa"><Icon name="key" size={26} /></span>
    <h2 class="text-2xl font-semibold tracking-tight">{copy.mfa.request}</h2>
    <p class="text-muted mt-3 text-sm leading-relaxed">{copy.mfa.subtitle}</p>
    <p
      class="mfa-code my-5 text-center text-5xl font-semibold tracking-[0.2em]"
      aria-label={`${copy.mfa.codeLabel} : ${copy.mfa.code}`}
    >
      {copy.mfa.code}
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
    <p class="mt-4 text-center text-sm font-semibold">{copy.mfa.clue}</p>
  </div>
</div>
