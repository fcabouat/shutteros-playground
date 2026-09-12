<script lang="ts">
  import Provider from '../src/lib/components/i18n/Provider.svelte';
  import Login from '../src/lib/components/screens/Login.svelte';
  import Session from '../src/lib/components/screens/Session.svelte';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { Locale } from '@shutteros/core/data/catalog';
  import { transition } from '@shutteros/core/runtime/game';
  import { untrack } from 'svelte';
  import projectLicense from '../LICENSE?raw';
  import thirdPartyNotices from '../static/THIRD-PARTY-NOTICES.txt?raw';

  let {
    initial,
    config,
    locale = 'fr',
  }: { initial: GameState; config: GameConfig; locale?: Locale } = $props();
  let snapshot = $state.raw<GameState>(untrack(() => initial));
  const dispatch = (intent: Intent) =>
    (snapshot = transition(snapshot, intent, snapshot.now, config));
</script>

<Provider initialLocale={locale}>
  {#key snapshot.generation}
    {#if snapshot.phase === 'login'}<Login {snapshot} {config} {dispatch} />{:else}<Session
        {snapshot}
        {config}
        {dispatch}
        legalNotices={{ projectLicense, thirdPartyNotices }}
      />{/if}
  {/key}
</Provider>
