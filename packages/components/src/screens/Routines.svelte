<script lang="ts">
  import { pendingRoutines } from '@shutteros/core/projections/game';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import KnowledgeCheck from '../commons/KnowledgeCheck.svelte';
  import Icon from '../commons/Icon.svelte';
  import EmphasizedText from '../commons/EmphasizedText.svelte';
  let {
    snapshot,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    dispatch: (intent: Intent) => void;
  } = $props();
  let checkOpen = $state(false);
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const guidedSequence = $derived(snapshot.mode === 'guided' && snapshot.scene.kind === 'routines');
  const nextRoutine = $derived(pendingRoutines(snapshot)[0] ?? null);
  const nextStep = $derived(nextRoutine === null ? null : copy.routines.steps[nextRoutine]);
</script>

<section class:routines-page={snapshot.scene.kind === 'routines'}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The bounded activity region needs keyboard focus for scrolling.) -->
  <div
    class="routines-content p-5 sm:p-7"
    role="region"
    aria-label={copy.routines.title}
    tabindex={snapshot.scene.kind === 'routines' ? 0 : undefined}
  >
    <div class="reading-column wide">
      <h1 class="text-2xl font-semibold">{copy.routines.title}</h1>
      <p class="text-muted mt-2 text-sm">{copy.routines.subtitle}</p>
      {#if guidedSequence}
        <aside class="guided-routine-instruction mt-5 rounded-xl p-4">
          <p class="text-sm leading-relaxed">{copy.routines.guidedInstruction}</p>
          <p
            class="guided-routine-next mt-2 text-sm font-semibold"
            role="status"
            aria-live="polite"
          >
            {nextStep === null ? copy.routines.steps.complete : copy.routines.nextStep(nextStep)}
          </p>
        </aside>
      {/if}
      <div class="routine-grid mt-6 grid gap-6 md:grid-cols-3">
        {#each ['password', 'update', 'lock'] as item, index (item)}
          {@const id = item as 'password' | 'update' | 'lock'}
          {@const done =
            id === 'lock'
              ? snapshot.routines.lockPracticed
              : id === 'password'
                ? snapshot.routines.password === 'done'
                : snapshot.routines.update === 'scheduled'}
          <article
            class="routine-item flex flex-col"
            class:current={guidedSequence && nextRoutine === id}
            data-routine={id}
          >
            <Icon
              name={id === 'password' ? 'key' : id === 'update' ? 'monitor' : 'lock'}
              size={26}
            />
            <p class="text-muted mt-4 text-xs">{index + 1} / 3</p>
            <h2 class="mt-2 min-h-[3rem] text-lg leading-snug font-semibold">
              {copy.routines[id]}
            </h2>
            <p class="text-muted mt-3 grow text-sm leading-relaxed">{copy.routines[`${id}Body`]}</p>
            {#if done}<p class="lesson-box mt-4 rounded-lg p-3 text-sm" role="status">
                <strong>{copy.routines[`${id}Done`]}</strong>{#if id !== 'lock'}<span
                    class="mt-2 block leading-relaxed"
                    ><EmphasizedText
                      text={copy.routines[`${id}Lesson`]}
                      emphasis={copy.routines[`${id}Emphasis`]}
                    /></span
                  >{/if}
              </p>
            {:else}<button
                class="button button-soft mt-5"
                onclick={() =>
                  dispatch(
                    id === 'lock'
                      ? { type: 'practice-lock' }
                      : { type: 'routine', id, action: 'complete' },
                  )}>{copy.routines[`${id}Action`]}</button
              >{/if}
          </article>
        {/each}
      </div>
      {#if snapshot.routines.password === 'done' && snapshot.scene.kind === 'routines'}
        <div class="mt-6 border-t border-[var(--line)] pt-5">
          <button
            class="button button-soft"
            aria-expanded={checkOpen}
            onclick={() => (checkOpen = !checkOpen)}>{copy.routines.passwordCheck}</button
          >
          {#if checkOpen}<div class="mt-4"><KnowledgeCheck {snapshot} {dispatch} /></div>{/if}
        </div>
      {/if}
    </div>
  </div>
  {#if snapshot.scene.kind === 'routines'}
    <footer class="shrink-0 border-t border-[var(--line)] px-5 py-4 sm:px-7">
      <div class="window-actions">
        <button
          class="button button-primary"
          disabled={pendingRoutines(snapshot).length > 0}
          onclick={() => dispatch({ type: 'continue' })}
        >
          {copy.experience.review}<Icon name="arrow" size={17} />
        </button>
      </div>
    </footer>
  {/if}
</section>

<style>
  :global(.window-body:has(> .routines-page)) {
    display: flex;
    overflow: hidden;
  }
  .routines-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
  }
  .routines-page .routines-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .guided-routine-instruction {
    color: var(--accent-strong);
    background: var(--soft);
    border: 1px solid #c7dce3;
  }
  .guided-routine-next {
    color: var(--accent);
  }
  .routine-item.current {
    background: #f3f8f9;
    outline: 2px solid #78aebd;
    outline-offset: 0.35rem;
  }
</style>
