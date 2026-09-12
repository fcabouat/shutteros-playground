<script lang="ts">
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import Brand from '../commons/Brand.svelte';
  import OrganizationBrand from '../commons/OrganizationBrand.svelte';
  import Icon from '../commons/Icon.svelte';
  import Language from '../commons/Language.svelte';
  import type { Branding } from '../../branding.generated';

  let {
    snapshot,
    config,
    dispatch,
    embeddedOrganizationLogo,
    branding = { applicationName: 'ShutterOS' },
  }: {
    snapshot: Extract<GameState, { phase: 'login' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
    embeddedOrganizationLogo?: string;
    branding?: Branding;
  } = $props();
  let password = $state('');
  function login() {
    dispatch({ type: 'login', password });
    password = '';
  }
</script>

<main
  class="login-screen wallpaper relative flex min-h-dvh flex-col overflow-hidden p-5 sm:p-9 lg:p-12"
>
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  <div class="relative z-10 flex items-start justify-between gap-5">
    <OrganizationBrand
      name={branding.organizationName ?? config.organizationName}
      logo={branding.organizationLogo ?? embeddedOrganizationLogo ?? config.organizationLogo}
      campaign={branding.campaignName}
    />
    <span class="simulation-badge"><Icon name="shield" size={15} />{copy.simulation}</span>
  </div>

  <div
    class="relative z-10 mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_380px_1fr] lg:gap-14"
  >
    <div class="hidden lg:block"></div>

    <section
      class="login-account mx-auto w-full max-w-[380px] text-center"
      aria-label={copy.login.account}
    >
      <div
        class="avatar mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full sm:h-28 sm:w-28"
      >
        <Icon name="user" size={53} />
      </div>
      <h1 class="text-[2rem] font-medium tracking-tight">{config.playerName}</h1>
      <p class="mt-2 text-sm text-white/70">{copy.login.account}</p>

      <div class="mt-8 text-left">
        <label for="session-code" class="mb-2 block text-sm text-white/80"
          >{copy.login.password}</label
        >
        <div class="password-field flex items-center overflow-hidden rounded-lg">
          <input
            id="session-code"
            type="text"
            bind:value={password}
            maxlength={100}
            autocomplete="off"
            spellcheck="false"
            autocapitalize="off"
            onkeydown={(event) => {
              if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                login();
              }
            }}
            placeholder={copy.login.placeholder}
            aria-describedby={snapshot.failedAttempts >= 3 ? 'password-help' : undefined}
            aria-invalid={snapshot.failedAttempts > 0}
            class="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base outline-none"
          />
        </div>
        {#if snapshot.failedAttempts >= 3}<p
            id="password-help"
            class="mt-3 text-center text-xs text-white/85"
          >
            {copy.login.helper}
          </p>{/if}
        {#if snapshot.failedAttempts > 0}<p
            role="alert"
            class="login-error mt-3 rounded-lg p-3 text-sm"
          >
            {copy.login.error}
          </p>{/if}
        <button
          type="button"
          onclick={login}
          class="button button-lime mt-5 w-full justify-between px-5 py-3.5"
          >{copy.login.enter}<Icon name="arrow" size={20} /></button
        >
      </div>
      {#if snapshot.reason !== 'initial'}<p
          role="status"
          class="mt-5 text-sm leading-relaxed text-white/85"
        >
          {snapshot.reason === 'expired' ? copy.login.expired : copy.login.loggedOut}
        </p>{/if}
    </section>

    {#if config.showPasswordHint}
      <aside
        class="post-it relative mx-auto w-[260px] rotate-[4deg] p-7 text-left lg:mt-24"
        aria-label={copy.login.postitTitle}
      >
        <span class="tape" aria-hidden="true"></span>
        <p class="break-words py-6 text-center font-mono text-lg">{config.acceptedPasswords[0]}</p>
      </aside>
    {:else}
      <aside
        class="mx-auto max-w-[240px] text-center text-sm text-white/80"
        hidden={snapshot.failedAttempts < 3}
      >
        <Icon name="light" size={28} />
        <p class="mt-3">{copy.login.physicalHint}</p>
      </aside>
    {/if}
  </div>

  <footer
    class="relative z-10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/70"
  >
    <div class="flex items-center gap-4">
      <Brand name={branding.applicationName} />
    </div>
    <span class="hidden items-center gap-2 md:flex"
      ><Icon name="clock" size={14} />{copy.login.duration(config.sessionDurationMs / 60_000)}</span
    >
    <Language />
  </footer>
</main>
