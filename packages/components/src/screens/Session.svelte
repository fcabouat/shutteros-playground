<script lang="ts">
  import { tick } from 'svelte';
  import { Dialog } from 'bits-ui';
  import type { Branding } from './branding';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { GameState, Intent, ChallengeId } from '@shutteros/core/model/game';
  import {
    nextChallenge,
    pendingRoutines,
    remainingActivities,
    remainingSeconds,
    idleReminderVisible,
    nextAmbientEvent,
    incidentIsolated,
    ambientSlot,
    guidanceLevel,
    activityIsVisible,
    guidanceTarget,
    hasResult,
  } from '@shutteros/core/projections/game';
  import { activityDefinition } from '@shutteros/core/data/activities';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  import Guide from '../commons/Guide.svelte';
  import Language from '../commons/Language.svelte';
  import StartMenu from '../commons/StartMenu.svelte';
  import WindowFrame from '../commons/WindowFrame.svelte';
  import ActionDock from '../commons/ActionDock.svelte';
  import Organizations from '../commons/Organizations.svelte';
  import { focusScreen } from '../commons/focus';
  import Intro from './Intro.svelte';
  import Desktop from './Desktop.svelte';
  import Challenge from './Challenge.svelte';
  import Feedback from './Feedback.svelte';
  import Debrief from './Debrief.svelte';
  import Routines from './Routines.svelte';
  import Updates from './Updates.svelte';
  import About from './About.svelte';
  import ExitConfirmation from '../commons/ExitConfirmation.svelte';

  let {
    snapshot,
    config,
    dispatch,
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
    branding = { applicationName: 'ShutterOS' },
    legalNotices = null,
    legalNoticesFailed = false,
    documentVisible = true,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
    branding?: Branding;
    legalNotices?: { projectLicense: string; thirdPartyNotices: string } | null;
    legalNoticesFailed?: boolean;
    documentVisible?: boolean;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const actionPanelId = $props.id();
  // Window chrome belongs to this mounted view; outcomes, timing and routine progress
  // come from snapshot. Game.svelte's generation key resets both lifetimes together.
  let guideOpen = $state(false);
  let exitOpen = $state(false);
  let helpExpanded = $state(true);
  let minimized = $state(false);
  let settings = $state<'routines' | 'updates' | 'about' | null>(null);
  let idlePrompt = $state(false);
  let noticeExpanded = $state(false);
  let dismissedSlot = $state<number | null>(null);
  const activeId = $derived(snapshot.scene.kind === 'challenge' ? snapshot.scene.id : null);
  const seconds = $derived(remainingSeconds(snapshot.deadline, snapshot.now));
  const formattedTime = $derived(
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`,
  );
  const guideId = $derived(nextChallenge(snapshot));
  const guideRoutine = $derived(pendingRoutines(snapshot)[0] ?? null);
  const helpLevel = $derived(guidanceLevel(snapshot));
  const helpTarget = $derived(guidanceTarget(snapshot));
  const activityVisible = $derived(
    activeId !== null &&
      !minimized &&
      !settings &&
      !snapshot.locked &&
      !exitOpen &&
      documentVisible,
  );
  const actionOpen = $derived(activityVisible && helpLevel === 2 && helpExpanded);
  const family = $derived(
    activeId
      ? activityDefinition(activeId).family
      : snapshot.scene.kind === 'feedback'
        ? activityDefinition(snapshot.scene.result.id).family
        : snapshot.scene.kind === 'routines'
          ? 'protection'
          : undefined,
  );
  const hintKey = $derived(
    snapshot.scene.kind === 'challenge' && snapshot.scene.step === 'notify' ? 'notify' : activeId,
  );

  // Visibility comes from the browser boundary; the core alone accounts for elapsed
  // assistance time. Closing/minimizing an app never consumes its next hint delay.
  $effect(() => {
    if (activityIsVisible(snapshot) !== activityVisible)
      dispatch({ type: 'activity-visible', visible: activityVisible });
  });
  $effect(() => {
    void activeId;
    void helpLevel;
    helpExpanded = true;
  });
  async function focusChoices() {
    await tick();
    document.getElementById(actionPanelId)?.querySelector<HTMLElement>('input, button')?.focus();
  }
  function requestHint() {
    const opensChoices = helpLevel >= 1;
    helpExpanded = true;
    dispatch({ type: 'request-hint' });
    // Only an explicit request moves focus. Automatic help must not interrupt reading.
    if (opensChoices) void focusChoices();
  }
  function toggleChoices() {
    helpExpanded = !helpExpanded;
    if (helpExpanded) void focusChoices();
  }
  // Focus/scroll follow presentation changes. Window identity is deliberately coarser:
  // advancing a challenge step should not reconstruct its local form fields.
  const sceneKey = $derived(
    settings
      ? settings
      : minimized
        ? 'desktop'
        : snapshot.scene.kind === 'challenge'
          ? `challenge-${snapshot.scene.id}-${snapshot.scene.step}`
          : snapshot.scene.kind,
  );
  const windowId = $derived(
    snapshot.scene.kind === 'challenge' ? snapshot.scene.id : snapshot.scene.kind,
  );
  const windowTitle = $derived(
    activeId
      ? `${i18n.challenges[activeId].app}${hasResult(snapshot, activeId) ? ` · ${copy.desktop.replay}` : ''}`
      : snapshot.scene.kind === 'feedback'
        ? `${i18n.challenges[snapshot.scene.result.id].app}${snapshot.scene.replay ? ` · ${copy.desktop.replay}` : ''}`
        : snapshot.scene.kind === 'debrief'
          ? copy.debrief.eyebrow
          : snapshot.scene.kind === 'routines'
            ? copy.routines.title
            : branding.applicationName,
  );
  const isolated = $derived(incidentIsolated(snapshot));
  const canIsolateNetwork = $derived(
    snapshot.scene.kind === 'challenge' &&
      snapshot.scene.id === 'incident' &&
      snapshot.scene.step !== 'notify' &&
      !snapshot.locked,
  );
  const clockText = $derived(
    new Intl.DateTimeFormat(i18n.locale, { hour: '2-digit', minute: '2-digit' }).format(
      snapshot.now,
    ),
  );
  const slot = $derived(ambientSlot(snapshot, config));
  const ambient = $derived(nextAmbientEvent(snapshot, config));
  const notice = $derived(
    idlePrompt && !snapshot.routines.lockPracticed
      ? 'lock'
      : slot !== dismissedSlot
        ? ambient
        : null,
  );
  const noticeAllowed = $derived(
    snapshot.mode === 'free' &&
      !guideOpen &&
      !settings &&
      !snapshot.locked &&
      snapshot.scene.kind === 'desktop',
  );

  $effect(() => {
    if (idleReminderVisible(snapshot, config)) idlePrompt = true;
  });

  function execute(intent: Intent) {
    if (intent.type === 'logout') {
      exitOpen = true;
      return;
    }
    guideOpen = false;
    settings = null;
    minimized = false;
    // Restore a minimized app without starting a new core attempt or clearing its draft.
    if (intent.type === 'open' && intent.id === activeId) return;
    dispatch(intent);
  }
  function closeWindow() {
    if (snapshot.scene.kind === 'intro' || snapshot.scene.kind === 'feedback')
      execute({ type: 'continue' });
    else execute({ type: 'close' });
  }
  function dismissNotice() {
    idlePrompt = false;
    noticeExpanded = false;
    dismissedSlot = slot;
    dispatch({ type: 'dismiss-idle' });
  }
  function openSettings(view: 'routines' | 'updates' | 'about' = 'routines') {
    guideOpen = false;
    settings = view;
    noticeExpanded = false;
    dismissedSlot = slot;
  }
  function isolateNetwork() {
    if (canIsolateNetwork) execute({ type: 'choose', choiceId: 'isolate' });
  }
</script>

<div
  data-active-hint={activityVisible && helpLevel > 0 ? helpTarget : undefined}
  class="session-screen wallpaper relative flex min-h-dvh flex-col"
>
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  <a href="#session-main" class="skip-link">{copy.shell.skip}</a>
  <header class="contents">
    <div class="desktop-organization absolute left-5 top-3 z-10">
      <Organizations
        name={branding.organizationName ?? config.organizationName}
        logo={branding.organizationLogo ?? embeddedOrganizationLogo ?? config.organizationLogo}
        partnerName={branding.partnerOrganizationName ?? config.partnerOrganizationName}
        partnerLogo={branding.partnerOrganizationLogo ??
          embeddedPartnerOrganizationLogo ??
          config.partnerOrganizationLogo}
        campaign={branding.campaignName}
      />
    </div>
    <span class="sr-only">{copy.simulation}</span>
    <div class="session-controls absolute right-5 top-3 z-20 flex items-center gap-3">
      {#if snapshot.mode === 'free' && snapshot.scene.kind !== 'intro' && snapshot.scene.kind !== 'debrief'}
        <button
          class="finish-experience rounded-lg px-3 py-2 text-xs"
          title={copy.experience.finishHint}
          onclick={() => execute({ type: 'finish-experience' })}
          >{copy.experience.finish}<Icon name="arrow" size={14} class="ml-2 inline" /></button
        >
      {/if}
      <span
        class="session-timer flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-sm font-medium"
        class:urgent={seconds <= 30}
        title={copy.shell.timeout}
        role="timer"
        aria-live="off"
        aria-label={`${copy.shell.time} : ${formattedTime}`}
        ><Icon name="hourglass" size={17} /><span aria-hidden="true">{formattedTime}</span></span
      >
    </div>
    {#if seconds <= 30}<p class="sr-only" role="status">{copy.shell.lowTime}</p>{/if}
  </header>
  <main
    id="session-main"
    class="os-workspace relative z-10 outline-none"
    tabindex="-1"
    use:focusScreen={sceneKey}
    inert={snapshot.locked}
  >
    {#if !settings && (minimized || snapshot.scene.kind === 'desktop' || snapshot.scene.kind === 'challenge')}
      <h1 class="sr-only">
        {minimized || snapshot.scene.kind === 'desktop' ? copy.shell.desktop : windowTitle}
      </h1>
    {/if}
    <div class="desktop-plane">
      <Desktop
        {snapshot}
        dispatch={execute}
        {activeId}
        applicationName={branding.applicationName}
      />
    </div>
    <div class="window-layer">
      {#if activityVisible}
        <aside class="activity-guidance" aria-label={copy.shell.guide}>
          {#if helpLevel > 0 && helpExpanded && hintKey}
            <p role="status" class="guidance-message">
              <Icon name="light" size={19} />{copy.guidance.hints[hintKey]}
            </p>
          {/if}
          <div class="guidance-controls">
            {#if helpLevel < 2}
              <button
                class="guidance-trigger"
                aria-controls={actionPanelId}
                class:offered={helpLevel > 0}
                onclick={requestHint}
              >
                <Icon name="sparkles" size={20} /><span
                  >{helpLevel === 0 ? copy.guidance.first : copy.guidance.second}</span
                >
              </button>
            {:else}
              <button
                class="guidance-trigger offered"
                aria-expanded={helpExpanded}
                aria-controls={actionPanelId}
                onclick={toggleChoices}
              >
                <Icon name="light" size={20} />{helpExpanded
                  ? copy.guidance.close
                  : copy.guidance.choices}
              </button>
            {/if}
          </div>
        </aside>
      {/if}
      <div class="activity-layout" class:with-actions={actionOpen}>
        {#if snapshot.scene.kind !== 'desktop'}
          <!-- Keep drafts mounted behind settings/minimization, but remove hidden views
             from pointer and keyboard interaction. tests/e2e/game.spec.ts covers restore. -->
          {#key windowId}<div
              class="view-host"
              hidden={minimized || settings !== null}
              inert={minimized || settings !== null}
            >
              {#snippet currentView()}
                {#if snapshot.scene.kind === 'intro'}<Intro {snapshot} dispatch={execute} />
                {:else if snapshot.scene.kind === 'challenge'}<Challenge
                    {snapshot}
                    scene={snapshot.scene}
                    {config}
                    dispatch={execute}
                  />
                {:else if snapshot.scene.kind === 'feedback'}<Feedback
                    {snapshot}
                    result={snapshot.scene.result}
                    replay={snapshot.scene.replay}
                    dispatch={execute}
                  />
                {:else if snapshot.scene.kind === 'routines'}<Routines
                    {snapshot}
                    dispatch={execute}
                  />
                {:else if snapshot.scene.kind === 'debrief'}<Debrief
                    {snapshot}
                    {config}
                    dispatch={execute}
                  />{/if}
              {/snippet}
              {#if activeId === 'mfa'}
                <section
                  class="device-shell"
                  aria-label={copy.mfa.app}
                  tabindex="-1"
                  data-window-focus
                >
                  <div class="device-controls">
                    <span class="activity-family" data-family="vigilance"
                      ><Icon name="shield" size={14} />{copy.guidance.families.vigilance}</span
                    >
                    <button
                      class="icon-button"
                      aria-label={copy.os.minimize}
                      onclick={() => (minimized = true)}><Icon name="minus" size={18} /></button
                    >{#if snapshot.mode === 'free'}<button
                        class="icon-button"
                        aria-label={copy.shell.close}
                        onclick={closeWindow}><Icon name="close" size={18} /></button
                      >{/if}
                  </div>
                  {@render currentView()}
                </section>
              {:else}
                <WindowFrame
                  title={windowTitle}
                  {family}
                  icon={activeId ?? 'shield'}
                  large={snapshot.scene.kind !== 'intro'}
                  onMinimize={() => (minimized = true)}
                  onClose={snapshot.mode === 'free' &&
                  (snapshot.scene.kind !== 'debrief' || nextChallenge(snapshot) !== null)
                    ? closeWindow
                    : undefined}
                  resetScrollKey={sceneKey}
                  moveLabel={copy.experience.move}
                  moveHint={copy.experience.moveHint}
                >
                  {@render currentView()}
                </WindowFrame>
              {/if}
            </div>{/key}
        {/if}
        {#if settings}<div class="view-host">
            <WindowFrame
              title={settings === 'updates'
                ? copy.routines.updates
                : settings === 'about'
                  ? copy.about.title
                  : copy.routines.title}
              icon="monitor"
              family={settings === 'about' ? undefined : 'protection'}
              large
              onMinimize={() => (settings = null)}
              onClose={() => (settings = null)}
              resetScrollKey={sceneKey}
              moveLabel={copy.experience.move}
              moveHint={copy.experience.moveHint}
              >{#if settings === 'updates'}<Updates
                  {snapshot}
                  {dispatch}
                />{:else if settings === 'about'}<About
                  {legalNotices}
                  {legalNoticesFailed}
                />{:else}<Routines {snapshot} {dispatch} />{/if}</WindowFrame
            >
          </div>{/if}
        {#if snapshot.scene.kind === 'challenge'}
          {#key snapshot.scene.id}<div
              id={actionPanelId}
              class="guidance-panel-host"
              hidden={!actionOpen}
              inert={!actionOpen}
            >
              <ActionDock
                scene={snapshot.scene}
                dispatch={execute}
                open={actionOpen}
                panelId={actionPanelId}
              />
            </div>{/key}
        {/if}
      </div>
    </div>
  </main>
  {#if notice && noticeAllowed}
    <aside
      class="ambient-notice fixed bottom-[144px] right-5 z-30 rounded-xl p-3"
      aria-label={copy.routines.notification}
    >
      <div class="flex items-center gap-3">
        <Icon
          name={notice === 'password' ? 'key' : notice === 'update' ? 'monitor' : 'lock'}
          size={20}
        />
        <button
          class="flex-1 text-left text-sm font-medium"
          aria-expanded={noticeExpanded}
          onclick={() => (noticeExpanded = !noticeExpanded)}>{copy.routines[notice]}</button
        >
        <button
          class="icon-button shrink-0"
          aria-label={copy.routines.dismiss}
          onclick={dismissNotice}><Icon name="close" size={16} /></button
        >
      </div>
      {#if noticeExpanded}<p class="text-muted mt-3 text-sm leading-relaxed">
          {copy.routines[`${notice}Body`]}
        </p>
        <button
          class="button button-soft mt-3"
          onclick={() => {
            if (notice === 'lock') {
              dismissNotice();
              dispatch({ type: 'practice-lock' });
            } else openSettings(notice === 'update' ? 'updates' : 'routines');
          }}>{notice === 'lock' ? copy.routines.lockAction : copy.routines.open}</button
        >
      {/if}
    </aside>
  {/if}
  {#if !settings && !snapshot.locked && snapshot.scene.kind === 'desktop'}
    <div class="companion-dock fixed top-[72px] right-5 z-30">
      {#key guideId}<Guide
          bind:open={guideOpen}
          destination={guideId
            ? i18n.challenges[guideId].app
            : guideRoutine
              ? copy.guidance.families.protection
              : null}
          remaining={remainingActivities(snapshot)}
          canNavigate={snapshot.mode === 'free'}
          onNavigate={() => {
            if (guideId) execute({ type: 'open', id: guideId });
            else openSettings('routines');
          }}
        />{/key}
    </div>
  {/if}
  <footer
    class="os-taskbar fixed bottom-0 left-0 z-30 flex w-full items-center justify-between gap-3 border-t px-3 py-2 sm:px-5"
    inert={snapshot.locked}
  >
    <div class="flex items-center gap-1.5">
      <StartMenu
        {snapshot}
        {config}
        dispatch={execute}
        applicationName={branding.applicationName}
        onSettings={() => openSettings('updates')}
        onAccount={() => openSettings('routines')}
        onAbout={() => openSettings('about')}
      />
      {#each ['usb', 'mail', 'web'] as name (name)}
        {@const id = name as ChallengeId}
        <button
          class="os-taskbar-app taskbar-shortcut"
          class:active={activeId === id || (id === 'mail' && activeId === 'spoof')}
          disabled={(snapshot.mode === 'guided' &&
            activeId !== id &&
            !(id === 'mail' && activeId === 'spoof')) ||
            ['intro', 'feedback', 'debrief', 'routines'].includes(snapshot.scene.kind)}
          onclick={() =>
            execute({ type: 'open', id: id === 'mail' && activeId === 'spoof' ? 'spoof' : id })}
          aria-label={`${copy.os.openApp} ${copy.desktop[id]}`}
          title={copy.desktop[id]}
          ><span class="app-icon tiny" data-app={id}><Icon name={id} size={20} /></span></button
        >
      {/each}
      {#if (minimized && !activeId) || (activeId && !['usb', 'mail', 'spoof', 'web'].includes(activeId))}<button
          class="os-taskbar-app active"
          onclick={() => {
            minimized = false;
            settings = null;
          }}
          aria-label={copy.os.restore}><Icon name={activeId ?? 'monitor'} size={20} /></button
        >{/if}
    </div>
    <div class="flex items-center justify-end gap-2 sm:gap-3">
      <Language />
      {#if canIsolateNetwork}
        <button
          class="icon-button"
          type="button"
          data-hint-target="network"
          onclick={isolateNetwork}
          aria-label={copy.incident.isolateNetwork}
          title={copy.incident.isolateNetwork}><Icon name="wifi" size={17} /></button
        >
      {:else}
        <span title={isolated ? copy.shell.isolated : copy.shell.connected}
          ><Icon name={isolated ? 'wifiOff' : 'wifi'} size={17} /></span
        >
      {/if}
      <span class="hidden text-xs sm:inline">{clockText}</span><button
        class="os-power"
        onclick={() => execute({ type: 'logout' })}
        aria-label={copy.shell.logout}
        title={copy.shell.logout}><Icon name="power" size={17} /></button
      >
    </div>
  </footer>
</div>

<ExitConfirmation bind:open={exitOpen} onConfirm={() => dispatch({ type: 'logout' })} />

<Dialog.Root
  open={snapshot.locked}
  onOpenChange={(open) => {
    if (!open) dispatch({ type: 'resume-lock' });
  }}
>
  <Dialog.Portal
    ><Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content
      class="lock-screen wallpaper fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-8 text-center"
      lang={i18n.locale}
    >
      <Icon name="lock" size={48} />
      <Dialog.Title class="text-3xl font-semibold">{copy.routines.locked}</Dialog.Title>
      <p class="text-lg">{config.playerName}</p>
      <Dialog.Description class="max-w-[500px] text-sm leading-relaxed text-white/80"
        >{copy.routines.lockNote}</Dialog.Description
      >
      <Dialog.Close class="button button-lime">{copy.routines.unlock}</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
