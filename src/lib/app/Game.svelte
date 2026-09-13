<script lang="ts">
  import { onMount } from 'svelte';
  import {
    configure,
    loadConfiguration,
    type ConfigurationResult,
  } from '../infrastructure/configuration';
  import { loadLegalNotices, type LegalNotices } from '../infrastructure/legal-notices';
  import { browserClock } from '../infrastructure/clock';
  import { createKioskInput } from '../infrastructure/kiosk-input';
  import { createRuntime } from './runtime';
  import { initialState } from '@shutteros/core/runtime/game';
  import { getI18n } from '../components/i18n/context';
  import { preferredLocale } from '../components/i18n/locale';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let kioskInput: ReturnType<typeof createKioskInput> | undefined;
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import Login from '../components/screens/Login.svelte';
  import Session from '../components/screens/Session.svelte';
  import Brand from '../components/commons/Brand.svelte';
  import Icon from '../components/commons/Icon.svelte';
  import { branding } from '../branding.generated';

  let {
    configuration,
    configurationUrl = './kiosk-config.json',
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
  }: {
    configuration?: unknown;
    configurationUrl?: string;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
  } = $props();
  // The prerender and first client render share this neutral loading state. Browser
  // configuration and time enter after onMount, avoiding a hydration-time state split.
  let result = $state.raw<ConfigurationResult | null>(null);
  let game = $state.raw<GameState>(initialState());
  let runtime: ReturnType<typeof createRuntime> | undefined;
  let abort: AbortController | undefined;
  let noticesAbort: AbortController | undefined;
  let legalNotices = $state.raw<LegalNotices | null>(null);
  let legalNoticesFailed = $state(false);
  let mounted = false;
  let loadGeneration = 0;

  // Retry owns a new generation as well as cancellation: an old fetch may finish
  // after abort, but it must not install a runtime over a newer configuration load.
  async function start() {
    const generation = ++loadGeneration;
    abort?.abort();
    runtime?.dispose();
    runtime = undefined;
    result = null;
    abort = new AbortController();
    const loaded =
      configuration === undefined
        ? await loadConfiguration(configurationUrl, abort.signal)
        : configure(configuration);
    if (!mounted || generation !== loadGeneration) return;
    result = loaded;
    if (loaded.ok)
      runtime = createRuntime(loaded.config, browserClock(), (state) => (game = state));
  }

  // About is an independent resource. Its error state must not replace a playable
  // configuration or erase the current session while notices are being fetched.
  async function loadNotices() {
    noticesAbort?.abort();
    const controller = new AbortController();
    noticesAbort = controller;
    legalNoticesFailed = false;
    const loaded = await loadLegalNotices('./THIRD-PARTY-NOTICES.txt', controller.signal);
    if (!mounted || controller.signal.aborted) return;
    if (loaded.ok) legalNotices = loaded.notices;
    else legalNoticesFailed = true;
  }

  function dispatch(intent: Intent) {
    if (intent.type === 'login') void kioskInput?.activate();
    runtime?.dispatch(intent);
  }
  function operatorShortcut(event: KeyboardEvent) {
    activity();
    if (event.ctrlKey && event.altKey && event.key === 'Home') {
      // This operator path intentionally bypasses the player's exit confirmation.
      event.preventDefault();
      dispatch({ type: 'logout' });
    }
  }
  function activity() {
    // Pointer movement is noisy; a second-level activity timestamp is enough for
    // the idle reminder and avoids reducing/publishing on every movement event.
    if (game.phase === 'session' && game.now - game.routines.lastActivityAt >= 1000)
      dispatch({ type: 'activity' });
  }

  // Document metadata is a browser effect owned by the application boundary.
  $effect(() => {
    document.documentElement.lang = i18n.locale;
  });

  onMount(() => {
    mounted = true;
    // An explicit URL choice is useful for links and previews; otherwise follow
    // the browser preference. The query is intentionally ephemeral and never saved.
    const requested = new URLSearchParams(window.location.search).get('lang');
    const locale =
      requested === 'fr' || requested === 'en'
        ? requested
        : preferredLocale(navigator.languages ?? [navigator.language]);
    i18n.changeLocale(locale);
    kioskInput = createKioskInput(window, document, navigator);
    void start();
    void loadNotices();
    return () => {
      mounted = false;
      ++loadGeneration;
      abort?.abort();
      noticesAbort?.abort();
      runtime?.dispose();
      kioskInput?.dispose();
    };
  });
</script>

<svelte:window onkeydown={operatorShortcut} onpointermove={activity} onpointerdown={activity} />
<svelte:head><title>{branding.applicationName} — {copy.tagline}</title></svelte:head>

{#if result?.ok}
  <!-- Resetting the domain alone would leave component drafts and dialogs alive.
       The generation key remounts them; tests/e2e/game.spec.ts covers an open-dialog reset. -->
  {#key game.generation}
    {#if game.phase === 'login'}<Login
        snapshot={game}
        config={result.config}
        {dispatch}
        {branding}
        {embeddedOrganizationLogo}
        {embeddedPartnerOrganizationLogo}
      />
    {:else}<Session
        snapshot={game}
        config={result.config}
        {dispatch}
        {branding}
        {legalNotices}
        {legalNoticesFailed}
        {embeddedOrganizationLogo}
        {embeddedPartnerOrganizationLogo}
      />{/if}
  {/key}
{:else}
  <main class="wallpaper flex min-h-dvh flex-col items-center justify-center gap-7 p-7 text-white">
    <Brand name={branding.applicationName} />
    {#if result && !result.ok}<div
        class="window-surface max-w-[660px] rounded-2xl p-7 text-[var(--ink)]"
      >
        <Icon name="help" size={30} />
        <h1 class="mt-4 text-2xl font-semibold">{copy.configurationError}</h1>
        <p class="text-muted mt-4 leading-relaxed">{copy.configurationHelp}</p>
        <ul class="mt-4 list-inside list-disc space-y-2 text-sm">
          {#each result.issues as issue, index (index)}<li
              class="break-words"
              lang={issue.kind === 'field' ? 'en' : undefined}
            >
              {issue.kind === 'field'
                ? `${issue.path}: ${issue.message}`
                : issue.kind === 'fetch'
                  ? copy.fetchError
                  : copy.sizeError}
            </li>{/each}
        </ul>
        <button class="button button-primary mt-6" onclick={() => void start()}>{copy.retry}</button
        >
      </div>
    {:else}<p role="status">{copy.loading}</p>{/if}
  </main>
{/if}
