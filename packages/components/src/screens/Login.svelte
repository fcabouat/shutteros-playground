<script lang="ts">
  import { onMount } from 'svelte';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import { loginHintVisible } from '@shutteros/core/projections/game';
  import { passwordHint } from '@shutteros/core/services/passwords';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import Brand from '../commons/Brand.svelte';
  import Organizations from '../commons/Organizations.svelte';
  import Icon from '../commons/Icon.svelte';
  import Language from '../commons/Language.svelte';
  import type { Branding } from './branding';

  let {
    snapshot,
    config,
    dispatch,
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
    branding = { applicationName: 'ShutterOS' },
  }: {
    snapshot: Extract<GameState, { phase: 'login' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
    branding?: Branding;
  } = $props();
  let password = $state('');
  let passwordVisible = $state(false);
  let supportsTextSecurity = $state(true);
  const showHelp = $derived(loginHintVisible(snapshot));
  function login() {
    dispatch({ type: 'login', password });
    password = '';
    passwordVisible = false;
  }

  onMount(() => {
    supportsTextSecurity = CSS.supports('-webkit-text-security', 'disc');
  });
</script>

<main
  class="login-screen wallpaper relative flex min-h-dvh flex-col overflow-hidden p-5 sm:p-9 lg:p-12"
>
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  <div class="relative z-10 flex items-start justify-between gap-5">
    <Organizations
      name={branding.organizationName ?? config.organizationName}
      logo={branding.organizationLogo ?? embeddedOrganizationLogo ?? config.organizationLogo}
      partnerName={branding.partnerOrganizationName ?? config.partnerOrganizationName}
      partnerLogo={branding.partnerOrganizationLogo ??
        embeddedPartnerOrganizationLogo ??
        config.partnerOrganizationLogo}
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
          <!-- A fictional access phrase uses a text input outside a credential form.
               This reduces password-manager prompts; autocomplete is only a browser hint. -->
          <input
            id="session-code"
            type={passwordVisible || supportsTextSecurity ? 'text' : 'password'}
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
            aria-describedby={[
              showHelp ? 'password-help' : '',
              snapshot.failedAttempts > 0 ? 'password-error' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined}
            aria-invalid={snapshot.failedAttempts > 0}
            class:minimal-secret-mask={supportsTextSecurity && !passwordVisible}
            class="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base outline-none"
          />
          <button
            type="button"
            class="mr-1 rounded-md p-2 text-white/75 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--lime)]"
            aria-label={passwordVisible ? copy.login.hidePassword : copy.login.showPassword}
            aria-pressed={passwordVisible}
            aria-controls="session-code"
            onclick={() => (passwordVisible = !passwordVisible)}
            onmousedown={(event) => event.preventDefault()}
          >
            <Icon name={passwordVisible ? 'eyeOff' : 'eye'} size={19} />
          </button>
        </div>
        {#if showHelp}<p
            id="password-help"
            role="status"
            class="mt-3 text-center text-xs text-white/85"
          >
            {copy.login.helper}
          </p>{/if}
        {#if snapshot.failedAttempts > 0}<p
            id="password-error"
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
        <p class="post-it-phrase break-words py-6 text-center font-mono text-lg">
          {passwordHint(config, i18n.locale)}
        </p>
      </aside>
    {:else}
      <aside class="mx-auto max-w-[240px] text-center text-sm text-white/80" hidden={!showHelp}>
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

<style>
  .minimal-secret-mask {
    -webkit-text-security: disc;
  }
</style>
