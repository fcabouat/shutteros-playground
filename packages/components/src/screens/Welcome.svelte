<script lang="ts">
  import welcomeHero from '../assets/welcome-hero.webp';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { GameState, Intent, PlayMode } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import type { Branding } from './branding';
  import GameTopbar from '../commons/GameTopbar.svelte';
  import OnboardingControls from '../commons/OnboardingControls.svelte';
  import Icon from '../commons/Icon.svelte';
  import Language from '../commons/Language.svelte';
  import Brand from '../commons/Brand.svelte';

  let {
    snapshot,
    config,
    dispatch,
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
    branding = { applicationName: 'ShutterOS' },
  }: {
    snapshot: Extract<GameState, { phase: 'welcome' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
    branding?: Branding;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);

  function selectMode(mode: PlayMode) {
    dispatch({ type: 'set-mode', mode });
  }
</script>

<main class="welcome-screen wallpaper relative flex min-h-dvh flex-col overflow-hidden">
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  {#snippet controls()}
    <OnboardingControls mode={snapshot.mode} />
  {/snippet}
  <GameTopbar
    {config}
    {branding}
    {embeddedOrganizationLogo}
    {embeddedPartnerOrganizationLogo}
    {controls}
  />

  <img class="welcome-hero" src={welcomeHero} alt="" aria-hidden="true" />
  <div
    class="welcome-body relative z-10 mx-auto grid w-full max-w-[1280px] flex-1 items-center px-5 py-5 sm:px-9 lg:grid-cols-[minmax(0,720px)_1fr] lg:px-12"
  >
    <section class="welcome-panel rounded-3xl p-5 sm:p-7">
      <p class="eyebrow text-accent">{copy.welcome.eyebrow}</p>
      <h1
        class="mt-3 max-w-[680px] text-3xl leading-tight font-semibold tracking-tight sm:text-3xl"
      >
        {copy.welcome.title}
      </h1>
      <p class="text-muted mt-4 max-w-[650px] text-base leading-relaxed">
        {copy.welcome.description(config.playerName)}
      </p>
      <div
        class="mt-5 grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label={copy.welcome.choose}
      >
        {#each ['guided', 'free'] as const as mode (mode)}
          <label class="mode-card text-left" class:selected={snapshot.mode === mode}>
            <input
              class="mode-selection"
              type="radio"
              name="play-mode"
              value={mode}
              checked={snapshot.mode === mode}
              onchange={() => selectMode(mode)}
            />
            <span class="mode-icon"
              ><Icon name={mode === 'guided' ? 'checkbox' : 'cursor'} size={24} /></span
            >
            <strong
              >{mode === 'guided' ? copy.welcome.guided.title : copy.welcome.free.title}</strong
            >
            <span
              >{mode === 'guided'
                ? copy.welcome.guided.description
                : copy.welcome.free.description}</span
            >
            <small
              >{mode === 'guided' ? copy.welcome.guided.detail : copy.welcome.free.detail}</small
            >
          </label>
        {/each}
      </div>

      <aside
        class="topbar-explainer mode-reassurance mt-4 rounded-2xl p-4"
        aria-label={copy.welcome.controls.title}
      >
        <p class="text-sm font-semibold">{copy.welcome.switchTitle}</p>
        <p class="text-muted mt-2 text-sm leading-relaxed">{copy.welcome.switchDetail}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          {#each copy.welcome.controls.items as item, index (item.title)}
            <div class="flex gap-3">
              <span class="explainer-icon"
                ><Icon
                  name={index === 0 ? 'sparkles' : index === 1 ? 'light' : 'hourglass'}
                  size={17}
                /></span
              >
              <p class="text-xs leading-relaxed">
                <strong class="block">{item.title}</strong>{item.detail}
              </p>
            </div>
          {/each}
        </div>
      </aside>
      <div class="welcome-families mt-4 grid gap-3 sm:grid-cols-2">
        <p class="family-note" data-family="vigilance">
          <Icon name="shield" size={18} />{copy.welcome.families.vigilance}
        </p>
        <p class="family-note" data-family="protection">
          <Icon name="secure" size={18} />{copy.welcome.families.protection}
        </p>
      </div>
      {#if snapshot.reason === 'expired'}
        <p class="welcome-reset mt-5 text-sm" role="status">
          {copy.welcome.expired}
        </p>
      {/if}
      <div class="welcome-start mt-5 border-t border-[var(--line)] pt-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <span class="text-muted flex items-center gap-2 text-sm">
            <Icon name="clock" size={17} />{copy.welcome.duration}
          </span>
          <button class="button button-primary ml-auto" onclick={() => dispatch({ type: 'begin' })}>
            {copy.welcome.begin}<Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </section>
  </div>
  <footer
    class="welcome-footer relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-3 text-xs text-white/75 sm:px-9 lg:px-12"
  >
    <Brand name={branding.applicationName} />
    <p class="order-last w-full text-center leading-relaxed sm:order-none sm:w-auto sm:flex-1">
      {copy.fictional}
      {copy.welcome.reset(config.sessionDurationMs / 60_000)}
    </p>
    <Language />
  </footer>
</main>

<style>
  .mode-reassurance {
    color: var(--accent-strong);
    background: var(--soft);
    border-left: 3px solid var(--accent);
  }
</style>
