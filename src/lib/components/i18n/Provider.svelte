<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { Locale } from '@shutteros/core/data/catalog';
  import { fr } from '@shutteros/core/data/fr';
  import { en } from '@shutteros/core/data/en';
  import { challenges, incidentNotify } from '@shutteros/core/data/challenges';
  import { englishChallenges, englishIncidentNotify } from '@shutteros/core/data/challenges.en';
  import { provideI18n } from './context';

  let { initialLocale = 'fr', children }: { initialLocale?: Locale; children: Snippet } = $props();
  let locale = $state<Locale>(untrack(() => initialLocale));
  provideI18n({
    get locale() {
      return locale;
    },
    get text() {
      return locale === 'fr' ? fr : en;
    },
    get challenges() {
      return locale === 'fr' ? challenges : englishChallenges;
    },
    get incidentNotify() {
      return locale === 'fr' ? incidentNotify : englishIncidentNotify;
    },
    changeLocale(next) {
      locale = next;
    },
  });
</script>

<div lang={locale} class="contents">{@render children()}</div>
