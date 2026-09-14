<script lang="ts">
  import Provider from '@shutteros/components/i18n/Provider.svelte';
  import Login from '@shutteros/components/screens/Login.svelte';
  import Session from '@shutteros/components/screens/Session.svelte';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { Locale } from '@shutteros/core/data/catalog';
  import { transition } from '@shutteros/core/runtime/game';
  import { untrack } from 'svelte';
  const projectLicense = 'Story fixture: project license';
  const thirdPartyNotices = 'Story fixture: third-party software notices';

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
