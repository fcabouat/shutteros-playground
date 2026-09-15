<script lang="ts">
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import {
    challengeOrder,
    safeCount,
    cautionCount,
    assessedCount,
    pendingRoutines,
    resultAssessment,
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
</script>

<section class="debrief-view w-full">
  <div class="debrief-heading px-5 py-5 sm:px-7">
    <div class="reading-column wide">
      <h1 class="max-w-[650px] text-2xl leading-tight font-semibold tracking-tight">
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
              <p class="text-muted mt-0.5 text-xs leading-relaxed">{copy.debrief.passwordNote}</p>
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

<style>
  :global(.os-window:has(.debrief-view)) {
    height: 100%;
  }
  :global(.window-body:has(> .debrief-view)) {
    display: flex;
    overflow: hidden;
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
  .debrief-content {
    flex: 1;
    min-height: 0;
    padding-block: 1rem;
    overflow: hidden;
  }
  .debrief-columns {
    height: 100%;
    min-height: 0;
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
  @media (max-height: 620px) {
    .debrief-content {
      overflow-y: auto;
    }
    .debrief-columns {
      height: auto;
    }
    .debrief-list {
      max-height: 250px;
      flex: auto;
    }
    .debrief-takeaways {
      max-height: 180px;
    }
    .debrief-heading > div > p {
      display: none;
    }
  }
</style>
