<script lang="ts">
  import { onMount } from 'svelte';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import { loginHintVisible } from '@shutteros/core/projections/game';
  import { passwordHint } from '@shutteros/core/services/passwords';
  import type { GameState, Intent, LoginChoiceId } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import Brand from '../commons/Brand.svelte';
  import GameTopbar from '../commons/GameTopbar.svelte';
  import OnboardingControls from '../commons/OnboardingControls.svelte';
  import Icon from '../commons/Icon.svelte';
  import Language from '../commons/Language.svelte';
  import { focusScreen } from '../commons/focus';
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
  let hintDismissed = $state(false);
  const hintVisible = $derived(showHelp && !hintDismissed);
  let hintReported = $state(false);
  $effect(() => {
    if (hintVisible && !hintReported) {
      hintReported = true;
      dispatch({ type: 'hint-viewed' });
    }
  });
  function toggleHint() {
    if (hintVisible) {
      hintDismissed = true;
    } else if (showHelp) {
      hintDismissed = false;
    } else {
      hintDismissed = false;
      dispatch({ type: 'request-hint' });
    }
  }
  function login() {
    dispatch({ type: 'login', password });
    password = '';
    passwordVisible = false;
  }

  onMount(() => {
    supportsTextSecurity = CSS.supports('-webkit-text-security', 'disc');
  });
</script>

{#snippet note(compact: boolean)}
  {#if config.showPasswordHint}
    <aside
      class:compact
      class="post-it relative mx-auto w-[260px] rotate-[4deg] p-7 text-left"
      aria-label={copy.login.postitTitle}
    >
      <span class="tape" aria-hidden="true"></span>
      <p class="post-it-phrase break-words py-6 text-center font-mono text-lg">
        {passwordHint(config, i18n.locale)}
      </p>
    </aside>
  {:else}
    <aside class="mx-auto max-w-[240px] text-center text-sm text-white/80" hidden={!hintVisible}>
      <Icon name="light" size={28} />
      <p class="mt-3">{copy.login.physicalHint}</p>
    </aside>
  {/if}
{/snippet}

<main class="login-screen wallpaper relative flex min-h-dvh flex-col overflow-hidden">
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  {#snippet controls()}
    <OnboardingControls
      mode={snapshot.mode}
      onMode={() =>
        dispatch({ type: 'set-mode', mode: snapshot.mode === 'guided' ? 'free' : 'guided' })}
      onHint={toggleHint}
      {hintVisible}
      hintSeen={showHelp || hintReported}
    />
  {/snippet}
  <GameTopbar
    {config}
    {branding}
    {embeddedOrganizationLogo}
    {embeddedPartnerOrganizationLogo}
    {controls}
  />

  <div
    class="login-layout relative z-10 mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-8 px-5 py-8 sm:px-9 lg:gap-12 lg:px-12"
    class:guided={snapshot.mode === 'guided'}
    tabindex="-1"
    use:focusScreen={snapshot.mode}
  >
    {#if snapshot.mode === 'free'}<div class="hidden lg:block"></div>{/if}

    <div class="login-identity">
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
              data-window-focus={snapshot.mode === 'free' ? '' : undefined}
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
                hintVisible ? 'password-help' : '',
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
        {#if hintVisible}<p
            id="password-help"
            role="status"
            class="login-guidance mt-5 rounded-xl px-4 py-3 text-left text-sm leading-relaxed"
          >
            <Icon name="light" size={18} />
            <span
              >{copy.login.helper}{#if snapshot.mode === 'guided'}
                {copy.login.guidedAlternative}{/if}</span
            >
          </p>{/if}
        {#if snapshot.reason !== 'initial'}<p
            role="status"
            class="mt-5 text-sm leading-relaxed text-white/85"
          >
            {snapshot.reason === 'expired' ? copy.login.expired : copy.login.loggedOut}
          </p>{/if}
      </section>
      {#if snapshot.mode === 'guided'}
        <div class="login-note">{@render note(true)}</div>
      {/if}
    </div>

    {#if snapshot.mode === 'guided'}
      <div class="guided-login text-left">
        <fieldset class="space-y-3">
          <legend class="mb-3 text-base leading-relaxed font-semibold"
            >{copy.login.guidedQuestion}</legend
          >
          {#each copy.login.guidedChoices as choice (choice.id)}
            <button
              class="guided-login-choice"
              type="button"
              data-window-focus={choice.id === 'manager' ? '' : undefined}
              onclick={() =>
                dispatch({ type: 'answer-login', choiceId: choice.id as LoginChoiceId })}
            >
              <span>{choice.label}</span><Icon name="arrow" size={17} />
            </button>
          {/each}
        </fieldset>
      </div>
    {:else}
      {@render note(false)}
    {/if}
  </div>

  <footer
    class="relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-5 text-xs text-white/70 sm:px-9 lg:px-12"
  >
    <div class="flex items-center gap-4">
      <Brand name={branding.applicationName} />
    </div>
    <span class="hidden items-center gap-2 md:flex"
      ><Icon name="clock" size={14} />{copy.welcome.duration}</span
    >
    <Language />
  </footer>
</main>

<style>
  .post-it.compact {
    width: 220px;
    margin-top: 1.5rem;
    padding: 0.5rem 1rem;
  }
  .post-it.compact .post-it-phrase {
    padding-block: 1.375rem;
  }
  @media (min-width: 1024px) {
    .login-layout {
      grid-template-columns: 1fr 420px 1fr;
    }
    .login-layout.guided {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  @media (min-width: 1280px) {
    .login-layout.guided {
      max-width: 1440px;
      grid-template-columns: minmax(280px, 1fr) 360px minmax(360px, 1fr);
      column-gap: 2rem;
    }
    .guided .login-identity {
      display: contents;
    }
    .guided .login-account {
      grid-column: 2;
      grid-row: 1;
    }
    .guided .login-note {
      grid-column: 1;
      grid-row: 1;
    }
    .guided-login {
      grid-column: 3;
      grid-row: 1;
    }
    .post-it.compact {
      width: 260px;
      margin-top: 0;
      padding: 1.75rem;
    }
    .post-it.compact .post-it-phrase {
      padding-block: 1.5rem;
    }
  }

  .minimal-secret-mask {
    -webkit-text-security: disc;
  }
</style>
