<script lang="ts">
  import { tick } from 'svelte';
  import { Dialog } from 'bits-ui';
  import type { Branding } from './branding';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { GameState, Intent, ChallengeId } from '@shutteros/core/model/game';
  import { guidanceDelayMs } from '@shutteros/core/model/game';
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
    hasResult,
  } from '@shutteros/core/projections/game';
  import { activityDefinition } from '@shutteros/core/data/activities';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  import Guide from '../commons/Guide.svelte';
  import Language from '../commons/Language.svelte';
  import StartMenu from '../commons/StartMenu.svelte';
  import WindowFrame from '../commons/WindowFrame.svelte';
  import FloatingWindow from '../commons/FloatingWindow.svelte';
  import TaskbarApps, { type TaskbarAppEntry } from '../commons/TaskbarApps.svelte';
  import ReadmeWindow from '../scenarios/ReadmeWindow.svelte';
  import ActionDock from '../commons/ActionDock.svelte';
  import Organizations from '../commons/Organizations.svelte';
  import WallpaperCurtain from '../commons/WallpaperCurtain.svelte';
  import { hintTarget } from './guidance';
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
  const guidedMode = $derived(snapshot.mode === 'guided');
  let settings = $state<'routines' | 'updates' | 'about' | null>(null);
  let settingsMinimized = $state(false);
  let idlePrompt = $state(false);
  let noticeExpanded = $state(false);
  let dismissedSlot = $state<number | null>(null);
  const activeId = $derived(snapshot.scene.kind === 'challenge' ? snapshot.scene.id : null);
  const taskbarId = $derived(
    activeId ?? (snapshot.scene.kind === 'feedback' ? snapshot.scene.result.id : null),
  );
  // An activity and its feedback share the player's size choice; another activity
  // gets the default for its exploration mode.
  const windowDefaultsKey = $derived(`${snapshot.mode}:${taskbarId ?? snapshot.scene.kind}`);
  let coreMaximized = $derived(windowDefaultsKey.startsWith('guided:'));
  const coreUsesPinnedTaskbar = $derived(
    taskbarId !== null && ['usb', 'mail', 'spoof', 'web'].includes(taskbarId),
  );
  const settingsVisible = $derived(settings !== null && !settingsMinimized);
  const settingsTitle = $derived(
    settings === 'updates'
      ? copy.routines.updates
      : settings === 'about'
        ? copy.about.title
        : copy.routines.title,
  );
  const seconds = $derived(remainingSeconds(snapshot.deadline, snapshot.now));
  const formattedTime = $derived(
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`,
  );
  const guideId = $derived(nextChallenge(snapshot));
  const guideRoutine = $derived(pendingRoutines(snapshot)[0] ?? null);
  const helpLevel = $derived(guidanceLevel(snapshot));
  const helpTarget = $derived(hintTarget(snapshot.scene));
  const activityVisible = $derived(
    activeId !== null &&
      !minimized &&
      !settingsVisible &&
      !snapshot.locked &&
      !exitOpen &&
      documentVisible,
  );
  const desktopHelpVisible = $derived(
    snapshot.mode === 'free' &&
      (snapshot.scene.kind === 'desktop' || (snapshot.scene.kind === 'challenge' && minimized)) &&
      !settingsVisible &&
      !snapshot.locked &&
      !exitOpen &&
      documentVisible,
  );
  let desktopHelpSince = $state<number | null>(null);
  // Reuse the runtime's clock for this visual invitation. Opening help acknowledges
  // it; hidden screens and other activities must not accumulate a desktop nudge.
  $effect(() => {
    if (!desktopHelpVisible || guideOpen) desktopHelpSince = null;
    else if (desktopHelpSince === null) desktopHelpSince = snapshot.now;
  });
  const desktopAttention = $derived(
    desktopHelpSince !== null &&
      remainingActivities(snapshot) > 0 &&
      snapshot.now - desktopHelpSince >= guidanceDelayMs,
  );
  let acknowledgedHelpLevel = $state(-1);
  const activeStep = $derived(snapshot.scene.kind === 'challenge' ? snapshot.scene.step : null);
  $effect(() => {
    void activeId;
    void activeStep;
    acknowledgedHelpLevel = -1;
  });
  // Only elapsed, unrequested hint levels need a nudge. The keyed icon briefly
  // marks a newly offered level; the button and keyboard focus stay still.
  const activityAttention = $derived(
    activityVisible &&
      snapshot.mode === 'free' &&
      snapshot.scene.kind === 'challenge' &&
      helpLevel !== acknowledgedHelpLevel
      ? Math.max(0, helpLevel - snapshot.scene.guidance.requestedLevel)
      : 0,
  );
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
  let hintMinimized = $state(false);
  let seenHints = $state<string[]>([]);
  const choicesAvailable = $derived(
    guidedMode ||
      (snapshot.scene.kind === 'challenge' && snapshot.scene.guidance.requestedLevel === 2) ||
      (hintKey !== null && seenHints.includes(hintKey)),
  );
  const actionOpen = $derived(
    activityVisible && choicesAvailable && helpLevel === 2 && helpExpanded,
  );
  const hintButtonLabel = $derived(
    activityVisible && helpLevel > 0 && !hintMinimized
      ? copy.challenge.hideHint
      : hintKey && seenHints.includes(hintKey)
        ? copy.guidance.restore
        : copy.guidance.first,
  );
  $effect(() => {
    void activeId;
    void hintKey;
    // At level two the guided choices are the assistance; keep the text window
    // available in the taskbar without covering those choices.
    hintMinimized = helpLevel !== 1;
  });
  $effect(() => {
    if (
      activityVisible &&
      helpLevel > 0 &&
      !hintMinimized &&
      hintKey &&
      !seenHints.includes(hintKey)
    )
      seenHints = [...seenHints, hintKey];
  });
  function toggleHint() {
    acknowledgedHelpLevel = helpLevel;
    if (helpLevel === 0) {
      dispatch({ type: 'request-hint' });
    } else if (!hintMinimized) {
      hintMinimized = true;
    } else restoreHint();
  }
  function restoreHint() {
    activateCore();
    hintMinimized = false;
    void tick().then(() =>
      document.querySelector<HTMLElement>('.hint-window-layer')?.focus({ preventScroll: true }),
    );
  }
  function toggleChoices() {
    if (!choicesAvailable) return;
    acknowledgedHelpLevel = helpLevel;
    const opening = !actionOpen;
    if (opening && helpLevel < 2) dispatch({ type: 'request-choices' });
    helpExpanded = opening;
    if (opening) {
      hintMinimized = true;
      void focusChoices();
    }
  }
  // Focus/scroll follow presentation changes. Window identity is deliberately coarser:
  // advancing a challenge step should not reconstruct its local form fields.
  const coreSceneKey = $derived(
    minimized
      ? 'desktop'
      : snapshot.scene.kind === 'challenge'
        ? `challenge-${snapshot.scene.id}-${snapshot.scene.step}`
        : snapshot.scene.kind,
  );
  const sceneKey = $derived(settingsVisible && settings ? settings : coreSceneKey);
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
      !settingsVisible &&
      !snapshot.locked &&
      snapshot.scene.kind === 'desktop',
  );

  $effect(() => {
    if (idleReminderVisible(snapshot, config)) idlePrompt = true;
  });

  let readmeOpen = $state(false);
  let readmeMinimized = $state(false);
  // Auxiliary windows preserve their own visibility and drafts. These operations
  // only move UI focus; they never dispatch a game answer or start a new attempt.
  async function focusCore() {
    await tick();
    const target =
      document.querySelector<HTMLElement>(
        '.window-layer .view-host:not([hidden]) [data-window-focus]',
      ) ?? document.getElementById('session-main');
    target?.focus({ preventScroll: true });
  }
  function activateCore() {
    minimized = false;
    if (settings) settingsMinimized = true;
    readmeMinimized = true;
    hintMinimized = true;
    void focusCore();
  }
  async function minimizeAuxiliary(kind: 'readme' | 'hint') {
    if (kind === 'readme') readmeMinimized = true;
    else hintMinimized = true;
    await tick();
    document.querySelector<HTMLElement>(`[data-taskbar-window="${kind}"]`)?.focus();
  }
  async function closeReadme() {
    const returnToFile = activeId === 'usb' && !settingsVisible;
    // Let navigation restore a minimized explorer before closing the document;
    // then focus the file after the navigation focus effect has completed.
    if (returnToFile && minimized) {
      minimized = false;
      await tick();
    }
    readmeOpen = false;
    readmeMinimized = false;
    if (returnToFile) {
      await tick();
      document.getElementById('usb-file-2')?.focus({ preventScroll: true });
    } else await focusCore();
  }

  function execute(intent: Intent) {
    if (intent.type === 'open-usb-readme' && activeId === 'usb') {
      readmeOpen = true;
      readmeMinimized = false;
      hintMinimized = true;
    } else readmeMinimized = true;
    if (intent.type === 'logout') {
      exitOpen = true;
      return;
    }
    guideOpen = false;
    if (settings) settingsMinimized = true;
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
    readmeMinimized = true;
    hintMinimized = true;
    settings = view;
    settingsMinimized = false;
    noticeExpanded = false;
    dismissedSlot = slot;
  }
  function isolateNetwork() {
    if (canIsolateNetwork) execute({ type: 'choose', choiceId: 'isolate' });
  }
  function pinnedRepresents(id: ChallengeId) {
    return taskbarId === id || (id === 'mail' && taskbarId === 'spoof');
  }
  const taskbarEntries = $derived.by((): TaskbarAppEntry[] => {
    const entries: TaskbarAppEntry[] = (['usb', 'mail', 'web'] as const).map((id) => {
      const running = pinnedRepresents(id);
      const appTitle = id === 'usb' ? i18n.challenges.usb.app : copy.desktop[id];
      return {
        id,
        app: id,
        icon: id === 'usb' ? 'folder' : id,
        running,
        disabled:
          !running &&
          (snapshot.mode === 'guided' ||
            ['intro', 'feedback', 'debrief', 'routines'].includes(snapshot.scene.kind)),
        title: running ? windowTitle : appTitle,
        label: running ? `${copy.os.restore} · ${windowTitle}` : `${copy.os.openApp} ${appTitle}`,
        onSelect: () => {
          if (running) activateCore();
          else execute({ type: 'open', id });
        },
      };
    });
    if (snapshot.scene.kind !== 'desktop' && !coreUsesPinnedTaskbar) {
      entries.push({
        id: `core-${windowId}`,
        title: windowTitle,
        label: `${copy.os.restore} · ${windowTitle}`,
        icon: taskbarId ?? 'monitor',
        running: true,
        onSelect: activateCore,
      });
    }
    if (settings)
      entries.push({
        id: 'settings',
        title: settingsTitle,
        label: `${copy.os.restore} · ${settingsTitle}`,
        icon: settings === 'about' ? 'help' : settings === 'routines' ? 'key' : 'monitor',
        running: true,
        onSelect: () => {
          readmeMinimized = true;
          hintMinimized = true;
          settingsMinimized = false;
        },
      });
    if (readmeOpen)
      entries.push({
        id: 'readme',
        title: copy.usb.readme,
        label: `${copy.os.restore} · ${copy.usb.readme}`,
        icon: 'document',
        running: true,
        onSelect: () => {
          hintMinimized = true;
          readmeMinimized = false;
        },
      });
    if (hintKey && helpLevel > 0)
      entries.push({
        id: 'hint',
        title: copy.shell.guide,
        label: copy.guidance.restore,
        icon: 'light',
        running: true,
        onSelect: restoreHint,
      });
    return entries;
  });
</script>

<div
  data-active-hint={activityVisible && helpLevel > 0 && !hintMinimized ? helpTarget : undefined}
  class="session-screen wallpaper relative flex min-h-dvh flex-col"
>
  <div class="wallpaper-orbit" aria-hidden="true"></div>
  <WallpaperCurtain />
  <a href="#session-main" class="skip-link">{copy.shell.skip}</a>
  <header class="os-topbar" inert={snapshot.locked}>
    <div class="desktop-organization">
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
    <div class="session-controls">
      <div class="session-help">
        <div class="progress-slot">
          {#key guideId}<Guide
              bind:open={guideOpen}
              destination={guideId
                ? i18n.challenges[guideId].app
                : guideRoutine
                  ? copy.guidance.families.protection
                  : null}
              remaining={remainingActivities(snapshot)}
              attention={desktopAttention}
              canNavigate={desktopHelpVisible}
              onNavigate={() => {
                if (guideId) execute({ type: 'open', id: guideId });
                else openSettings('routines');
              }}
            />{/key}
        </div>
        <div class="primary-help-slot">
          {#if minimized && (snapshot.scene.kind === 'routines' || snapshot.scene.kind === 'debrief')}
            <button class="guidance-trigger offered" onclick={activateCore}>
              <Icon name={snapshot.scene.kind === 'debrief' ? 'checkbox' : 'key'} size={20} />
              <span
                >{snapshot.scene.kind === 'debrief'
                  ? copy.experience.review
                  : copy.routines.resume}</span
              >
            </button>
          {:else if activityVisible}
            <aside class="activity-guidance" aria-label={copy.shell.guide}>
              <button
                class="guidance-trigger"
                class:offered={helpLevel > 0}
                class:help-attention={activityAttention > 0 && helpLevel === 1}
                data-attention={activityAttention > 0 && helpLevel === 1 ? helpLevel : undefined}
                aria-expanded={helpLevel > 0 && !hintMinimized}
                onclick={toggleHint}
              >
                {#key activityAttention}<span class="help-cue" aria-hidden="true"
                    ><Icon name="light" size={20} /></span
                  >{/key}
                <span>{hintButtonLabel}</span>
              </button>
            </aside>
          {:else}
            <button class="guidance-trigger" disabled>
              <Icon name="light" size={20} /><span>{copy.guidance.first}</span>
            </button>
          {/if}
        </div>
        <button
          class="guidance-trigger choices-trigger"
          class:offered={activityVisible && helpLevel === 2}
          class:help-attention={activityAttention > 0 && helpLevel === 2}
          data-attention={activityAttention > 0 && helpLevel === 2 ? helpLevel : undefined}
          disabled={!activityVisible || !choicesAvailable}
          aria-expanded={actionOpen}
          aria-controls={actionPanelId}
          onclick={toggleChoices}
        >
          <Icon name="checkbox" size={20} /><span
            >{actionOpen ? copy.guidance.close : copy.guidance.choices}</span
          >
        </button>
      </div>
      <div class="session-finish">
        <button
          class="finish-experience rounded-lg px-3 py-2 text-xs"
          title={guidedMode ? copy.experience.freeHint : copy.experience.finishHint}
          disabled={snapshot.scene.kind === 'intro' || snapshot.scene.kind === 'debrief'}
          onclick={() => execute({ type: guidedMode ? 'explore-freely' : 'finish-experience' })}
          >{guidedMode ? copy.experience.free : copy.experience.finish}<Icon
            name="arrow"
            size={14}
            class="ml-2 inline"
          /></button
        >
      </div>
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
    {#if !settingsVisible && (minimized || snapshot.scene.kind === 'desktop' || snapshot.scene.kind === 'challenge')}
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
      <div class="activity-layout">
        {#if snapshot.scene.kind !== 'desktop'}
          <!-- Keep drafts mounted behind settings/minimization, but remove hidden views
             from pointer and keyboard interaction. tests/e2e/game.spec.ts covers restore. -->
          {#key windowId}<div
              class="view-host"
              hidden={minimized || settingsVisible}
              inert={minimized || settingsVisible}
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
              {#snippet choicesView()}
                {#if snapshot.scene.kind === 'challenge'}
                  <ActionDock
                    scene={snapshot.scene}
                    dispatch={execute}
                    open={actionOpen}
                    panelId={actionPanelId}
                  />
                {/if}
              {/snippet}
              <WindowFrame
                title={windowTitle}
                {family}
                variant={activeId === 'mfa' ? 'device' : 'application'}
                sizing={snapshot.scene.kind === 'debrief' ||
                (snapshot.scene.kind === 'challenge' && activeId !== 'incident')
                  ? 'workspace'
                  : 'content'}
                sidebar={choicesView}
                sidebarOpen={actionOpen}
                bind:maximized={coreMaximized}
                icon={activeId ?? 'shield'}
                onMinimize={() => (minimized = true)}
                onClose={snapshot.mode === 'free' &&
                (snapshot.scene.kind !== 'debrief' || nextChallenge(snapshot) !== null)
                  ? closeWindow
                  : undefined}
                resetScrollKey={coreSceneKey}
                moveLabel={copy.experience.move}
                moveHint={copy.experience.moveHint}
              >
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
                  {@render currentView()}
                {/if}
              </WindowFrame>
            </div>{/key}
        {/if}
        {#if settings}<div class="view-host" hidden={settingsMinimized} inert={settingsMinimized}>
            <WindowFrame
              title={settings === 'updates'
                ? copy.routines.updates
                : settings === 'about'
                  ? copy.about.title
                  : copy.routines.title}
              icon="monitor"
              family={settings === 'about' ? undefined : 'protection'}
              onMinimize={() => (settingsMinimized = true)}
              onClose={() => {
                settings = null;
                settingsMinimized = false;
              }}
              resetScrollKey={settings}
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
      </div>
    </div>
    {#if readmeOpen}
      <ReadmeWindow
        isHidden={readmeMinimized}
        onMinimize={() => void minimizeAuxiliary('readme')}
        onClose={() => void closeReadme()}
      />
    {/if}
    {#if hintKey && helpLevel > 0}
      <FloatingWindow
        kind="hint"
        title={copy.shell.guide}
        icon="light"
        isHidden={hintMinimized || !activityVisible}
        focusOnShow={false}
        minimizeLabel={copy.guidance.minimize}
        onMinimize={() => void minimizeAuxiliary('hint')}
      >
        <p class="hint-content" role="status">{copy.guidance.hints[hintKey]}</p>
        <div class="px-4 pb-4 pt-2">
          <button
            type="button"
            class="guidance-trigger"
            onclick={() => void minimizeAuxiliary('hint')}>{copy.challenge.hideHint}</button
          >
        </div>
      </FloatingWindow>
    {/if}
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
  <footer
    class="os-taskbar fixed bottom-0 left-0 z-30 flex w-full items-center justify-between gap-3 border-t px-3 py-2 sm:px-5"
    inert={snapshot.locked}
  >
    <div class="taskbar-windows">
      <StartMenu
        {snapshot}
        {config}
        dispatch={execute}
        applicationName={branding.applicationName}
        onSettings={() => openSettings('updates')}
        onAccount={() => openSettings('routines')}
        onAbout={() => openSettings('about')}
      />
      <TaskbarApps entries={taskbarEntries} />
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
