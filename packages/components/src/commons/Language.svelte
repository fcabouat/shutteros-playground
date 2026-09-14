<script lang="ts">
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';
  const i18n = getI18n();
</script>

<div
  class="language-switch inline-flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-xs"
>
  <Icon name="web" size={14} />
  <button
    lang="fr"
    class="rounded px-1.5 py-1"
    class:active={i18n.locale === 'fr'}
    aria-pressed={i18n.locale === 'fr'}
    onclick={() => i18n.changeLocale('fr')}>FR</button
  >
  <span class="opacity-40" aria-hidden="true">/</span>
  <button
    lang="en"
    class="rounded px-1.5 py-1"
    class:active={i18n.locale === 'en'}
    aria-pressed={i18n.locale === 'en'}
    onclick={() => i18n.changeLocale('en')}>EN</button
  >
</div>
