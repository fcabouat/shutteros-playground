<script lang="ts">
  import { tick } from 'svelte';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import {
    challengeOrder,
    safeCount,
    cautionCount,
    assessedCount,
    pendingRoutines,
    resultAssessment,
    debriefStats,
    journeySummary,
  } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const challenges = $derived(i18n.challenges);
  const copy = $derived(i18n.text);
  import Icon from '../commons/Icon.svelte';
  let {
    snapshot,
    config,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
  } = $props();
  let detailed = $state(false);
  let view = $state<HTMLElement>();
  const stats = $derived(debriefStats(snapshot));
  const journey = $derived(journeySummary(snapshot));
  async function showDetailed(next: boolean) {
    detailed = next;
    await tick();
    view?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }
</script>

{#if !detailed}
  <section class="debrief-view summary-view w-full" bind:this={view}>
    <div class="debrief-heading px-5 py-5 sm:px-7">
      <div class="reading-column wide">
        <p class="eyebrow">{copy.debrief.summary.eyebrow}</p>
        <h1 class="mt-2 text-2xl leading-tight font-semibold tracking-tight" tabindex="-1">
          {copy.debrief.summary.title}
        </h1>
        <p class="mt-3 max-w-[700px] text-sm leading-relaxed opacity-85">
          {copy.debrief.summary.description}
        </p>
      </div>
    </div>
    <div class="debrief-content p-5 sm:p-7">
      <div class="reading-column wide">
        <div class="summary-facts grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="summary-fact">
            <Icon name="checkbox" size={22} /><strong
              >{copy.debrief.summary.situations(stats.activitiesCompleted)}</strong
            >
          </div>
          <div class="summary-fact">
            <Icon name="secure" size={22} /><strong
              >{copy.debrief.summary.habits(stats.dailyHabitsCompleted)}</strong
            >
          </div>
          <div class="summary-fact">
            <Icon name="light" size={22} /><strong
              >{copy.debrief.summary.hints(journey?.hintCount ?? 0)}</strong
            >
          </div>
          <div class="summary-fact">
            <Icon name="cursor" size={22} /><span
              ><small>{copy.debrief.summary.journey}</small><strong
                >{copy.debrief.summary.modes[journey?.mode ?? snapshot.mode]}</strong
              ></span
            >
          </div>
        </div>

        <section class="mt-7" aria-labelledby="journey-badges">
          <h2 id="journey-badges" class="text-base font-semibold">{copy.debrief.summary.badges}</h2>
          <div class="mt-3 flex flex-wrap gap-3">
            {#if stats.activitiesCompleted > 0}<span class="journey-badge"
                ><Icon name="checkbox" size={18} />{copy.debrief.summary.activityBadge} · {stats.activitiesCompleted}</span
              >{/if}
            {#if stats.reportsMade > 0}<span class="journey-badge"
                ><Icon name="shield" size={18} />{copy.debrief.summary.reportBadge} · {stats.reportsMade}</span
              >{/if}
            {#if stats.workstationProtected}<span class="journey-badge" data-family="protection"
                ><Icon name="secure" size={18} />{copy.debrief.summary.protectedBadge}</span
              >{/if}
          </div>
        </section>
        <div class="lesson-box mt-7 rounded-xl p-5">
          <p class="text-sm leading-relaxed">{copy.debrief.privacy}</p>
        </div>
      </div>
    </div>
    <footer class="border-t border-[var(--line)] px-5 py-5 sm:px-7">
      <div class="reading-column wide flex flex-wrap items-center justify-between gap-4">
        <button class="button button-primary" onclick={() => void showDetailed(true)}>
          {copy.debrief.summary.detailed}<Icon name="arrow" size={17} />
        </button>
        <button class="button button-soft" onclick={() => dispatch({ type: 'logout' })}>
          {copy.shell.nextPlayer}
        </button>
      </div>
    </footer>
  </section>
{:else}
  <section class="debrief-view w-full" bind:this={view}>
    <div class="debrief-heading px-5 py-5 sm:px-7">
      <div class="reading-column wide">
        <button class="button button-text mb-3" onclick={() => void showDetailed(false)}>
          <Icon name="back" size={17} />{copy.debrief.backToSummary}
        </button>
        <h1 class="max-w-[650px] text-2xl leading-tight font-semibold tracking-tight" tabindex="-1">
          {copy.debrief.title}
        </h1>
        <p class="mt-4 max-w-[650px] text-sm leading-relaxed opacity-80">
          {copy.debrief.description}
        </p>
      </div>
    </div>
    <div class="debrief-content p-5 sm:p-7">
      <div class="debrief-columns reading-column wide grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div class="debrief-results">
          <p class="mb-1 text-base font-semibold">
            {copy.debrief.safeCount(
              safeCount(snapshot),
              cautionCount(snapshot),
              assessedCount(snapshot),
            )}
          </p>
          <p class="text-muted mb-5 text-xs">{copy.debrief.notGrade}</p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (This scroll region needs keyboard focus for arrow and Page Down navigation.) -->
          <ul
            class="debrief-list divide-y divide-[var(--line)]"
            tabindex="0"
            aria-label={copy.debrief.activities}
          >
            <li class="flex items-center gap-3 py-3">
              <span class="result-icon"><Icon name="key" size={18} /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{copy.debrief.password}</p>
                <p class="text-muted mt-0.5 text-xs leading-relaxed">
                  {copy.debrief.passwordNote(config.passwordManagerName)}
                </p>
              </div>
              <span class="result-status" data-outcome="discovered">{copy.debrief.discovered}</span>
            </li>
            {#each challengeOrder as id (id)}
              {@const result = snapshot.results.find((r) => r.id === id)}
              {@const assessment = result ? resultAssessment(result) : 'unseen'}
              <li class="flex items-center gap-3 py-3">
                <span class="result-icon"><Icon name={id} size={18} /></span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{copy.desktop[id]}</p>
                  <p class="text-muted mt-0.5 text-xs leading-relaxed">
                    {id === 'usb' && assessment === 'caution'
                      ? copy.usb.cautionSummary
                      : challenges[id].shortLesson}
                  </p>
                </div>
                <span
                  class="result-status"
                  class:simulated-incident={id === 'usb' && assessment === 'risky'}
                  data-outcome={assessment}
                  >{#if assessment === 'caution'}<Icon
                      name="incident"
                      size={13}
                    />{:else if id === 'usb' && assessment === 'risky'}<Icon
                      name="incident"
                      size={13}
                    />{/if}{result
                    ? id === 'usb' && assessment === 'risky'
                      ? copy.debrief.incident
                      : assessment === 'caution'
                        ? copy.debrief.caution
                        : assessment === 'safe'
                          ? copy.debrief.safe
                          : copy.debrief.risky
                    : copy.debrief.notSeen}</span
                >
              </li>
            {/each}
            <li class="flex items-center gap-3 py-3">
              <span class="result-icon"><Icon name="shield" size={18} /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{copy.guidance.families.protection}</p>
                <p class="text-muted mt-0.5 text-xs">
                  {copy.routines.password} · {copy.routines.update} · {copy.routines.lock}
                </p>
              </div>
              <span
                class="result-status"
                data-outcome={pendingRoutines(snapshot).length === 0 ? 'safe' : 'unseen'}
              >
                {3 - pendingRoutines(snapshot).length} / 3
              </span>
            </li>
          </ul>
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Overflowing takeaways must also be scrollable without a mouse.) -->
        <div class="debrief-takeaways" tabindex="0" role="region" aria-label={copy.debrief.three}>
          <div class="lesson-box rounded-xl p-4">
            <p class="eyebrow mb-3">{copy.debrief.three}</p>
            <div class="space-y-3">
              {#each copy.debrief.habits as habit, index (index)}<div class="flex gap-3">
                  <span class="habit-number">{index + 1}</span>
                  <p class="text-sm leading-relaxed">
                    <strong class="block text-base">{habit.title}</strong>{habit.detail}
                  </p>
                </div>{/each}
            </div>
          </div>
          <p class="text-muted mt-5 text-sm leading-relaxed">{copy.debrief.routine}</p>
          <div class="mt-5 flex gap-3 px-1">
            <Icon name="help" size={20} />
            <p class="text-sm leading-relaxed">
              <strong class="block">{config.supportLabel}</strong><span class="text-muted"
                >{config.supportContact}</span
              >
            </p>
          </div>
        </div>
      </div>
    </div>
    <footer class="border-t border-[var(--line)] px-5 py-5 sm:px-7">
      <div class="reading-column wide">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="font-semibold">{copy.debrief.thankYou}</p>
            <p class="text-muted mt-1 text-xs">{copy.debrief.privacy}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="button button-soft" onclick={() => dispatch({ type: 'close' })}
              >{copy.shell.resume}</button
            ><button class="button button-primary" onclick={() => dispatch({ type: 'logout' })}
              >{copy.shell.nextPlayer}<Icon name="arrow" size={17} /></button
            >
          </div>
        </div>
        <p class="text-muted mt-5 text-xs leading-relaxed">{copy.debrief.source}</p>
      </div>
    </footer>
  </section>
{/if}

<style>
  :global(.os-window:has(.debrief-view)) {
    height: 100%;
  }
  :global(.window-body:has(> .debrief-view)) {
    display: flex;
    overflow: hidden;
    container: debrief-window / size;
  }
  .debrief-view {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .debrief-heading,
  footer {
    flex: none;
    padding-block: 1rem;
  }
  .debrief-heading h1 {
    max-width: none;
  }
  .debrief-heading p {
    margin-top: 0.5rem;
  }
  .debrief-heading .button-text {
    color: inherit;
  }
  .debrief-heading .button-text:hover {
    background: #ffffff18;
  }
  .debrief-content {
    flex: 1;
    min-height: 0;
    padding-block: 1rem;
    overflow-y: auto;
  }
  .debrief-columns {
    height: 100%;
    min-height: 240px;
  }
  .debrief-results {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .debrief-list,
  .debrief-takeaways {
    min-height: 0;
    overflow-y: scroll;
    scrollbar-gutter: stable;
    padding-right: 0.75rem;
  }
  .debrief-list {
    flex: 1;
  }
  .result-status[data-outcome='caution'],
  .result-status.simulated-incident {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .result-status[data-outcome='caution'] {
    background: var(--warning-soft);
    color: var(--warning);
  }
  .result-status.simulated-incident {
    background: #fde8e7;
    color: #a32924;
  }
  .debrief-list::-webkit-scrollbar,
  .debrief-takeaways::-webkit-scrollbar {
    width: 10px;
  }
  .debrief-list::-webkit-scrollbar-track,
  .debrief-takeaways::-webkit-scrollbar-track {
    background: #edf1f4;
    border-radius: 8px;
  }
  .debrief-list::-webkit-scrollbar-thumb,
  .debrief-takeaways::-webkit-scrollbar-thumb {
    background: #788b99;
    border: 2px solid #edf1f4;
    border-radius: 8px;
  }
  footer :global(.mt-5) {
    margin-top: 0.5rem;
  }
  @media (max-width: 1023px) {
    .debrief-columns {
      grid-template-rows: minmax(150px, 1fr) minmax(80px, 0.6fr);
    }
    .debrief-heading {
      padding-block: 0.75rem;
    }
    .debrief-heading > div > p {
      display: none;
    }
    .debrief-heading h1 {
      font-size: 1.25rem;
    }
    footer {
      padding-block: 0.75rem;
    }
    footer :global(.font-semibold),
    footer :global(.mt-1),
    footer > div > p {
      display: none;
    }
  }
  /* Respond to the resized window, not only to the browser viewport. Keep the
     actions fixed while the central regions retain usable scroll areas. */
  @container debrief-window (max-height: 520px) {
    .debrief-heading,
    footer {
      padding-block: 0.75rem;
    }
    .debrief-heading h1 {
      font-size: 1.25rem;
    }
    .debrief-heading .button-text {
      margin-bottom: 0;
      min-height: 32px;
      padding-block: 0;
    }
    .debrief-heading > div > p,
    footer :global(.font-semibold),
    footer :global(.mt-1),
    footer > div > p {
      display: none;
    }
  }
</style>
