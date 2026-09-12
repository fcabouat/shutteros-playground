<script lang="ts">
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import { challengeOrder, safeCount } from '@shutteros/core/projections/game';
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
      <div class="mb-3 flex items-center gap-3">
        <span class="debrief-seal flex h-11 w-11 items-center justify-center rounded-xl"
          ><Icon name="secure" size={26} /></span
        >
        <p class="eyebrow">{copy.debrief.eyebrow}</p>
      </div>
      <h1 class="max-w-[650px] text-2xl leading-tight font-semibold tracking-tight">
        {copy.debrief.title}
      </h1>
      <p class="mt-4 max-w-[650px] text-sm leading-relaxed opacity-80">
        {copy.debrief.description}
      </p>
    </div>
  </div>
  <div class="p-5 sm:p-7">
    <div class="reading-column wide grid gap-7 lg:grid-cols-[1.15fr_1fr]">
      <div>
        <p class="mb-1 text-base font-semibold">
          {copy.debrief.safeCount(safeCount(snapshot), snapshot.results.length)}
        </p>
        <p class="text-muted mb-5 text-xs">{copy.debrief.notGrade}</p>
        <ul class="divide-y divide-[var(--line)]">
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
            <li class="flex items-center gap-3 py-3">
              <span class="result-icon"><Icon name={id} size={18} /></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{copy.desktop[id]}</p>
                <p class="text-muted mt-0.5 text-xs leading-relaxed">
                  {challenges[id].shortLesson}
                </p>
              </div>
              <span class="result-status" data-outcome={result?.outcome ?? 'unseen'}
                >{result ? copy.debrief[result.outcome] : copy.debrief.notSeen}</span
              >
            </li>
          {/each}
        </ul>
      </div>
      <div>
        <div class="lesson-box rounded-xl p-5">
          <p class="eyebrow mb-5">{copy.debrief.three}</p>
          <div class="space-y-5">
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
          {#if snapshot.results.length < challengeOrder.length}<button
              class="button button-soft"
              onclick={() => dispatch({ type: 'close' })}>{copy.shell.resume}</button
            >{/if}<button class="button button-primary" onclick={() => dispatch({ type: 'logout' })}
            >{copy.shell.nextPlayer}<Icon name="arrow" size={17} /></button
          >
        </div>
      </div>
      <p class="text-muted mt-5 text-xs leading-relaxed">{copy.debrief.source}</p>
    </div>
  </footer>
</section>
