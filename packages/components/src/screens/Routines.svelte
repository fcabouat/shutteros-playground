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
  }: { snapshot: Extract<GameState, { phase: 'session' }>; dispatch: (intent: Intent) => void } =
    $props();
  let checkOpen = $state(false);
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<section class="p-5 sm:p-7">
  <div class="reading-column wide">
    <h1 class="text-2xl font-semibold">{copy.routines.title}</h1>
    <p class="text-muted mt-2 text-sm">{copy.routines.subtitle}</p>
    <div class="routine-grid mt-6 grid gap-6 md:grid-cols-3">
      {#each ['password', 'update', 'lock'] as item, index (item)}
        {@const id = item as 'password' | 'update' | 'lock'}
        {@const done =
          id === 'lock'
            ? snapshot.routines.lockPracticed
            : id === 'password'
              ? snapshot.routines.password === 'done'
              : snapshot.routines.update === 'scheduled'}
        <article class="routine-item flex flex-col" data-routine={id}>
          <Icon name={id === 'password' ? 'key' : id === 'update' ? 'monitor' : 'lock'} size={26} />
          <p class="text-muted mt-4 text-xs">{index + 1} / 3</p>
          <h2 class="mt-2 min-h-[3rem] text-lg leading-snug font-semibold">{copy.routines[id]}</h2>
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
    {#if snapshot.scene.kind === 'routines'}<footer class="mt-7 border-t border-[var(--line)] pt-5">
        <button
          class="button button-primary"
          disabled={pendingRoutines(snapshot).length > 0}
          onclick={() => dispatch({ type: 'continue' })}
          >{copy.experience.review}<Icon name="arrow" size={17} /></button
        >
      </footer>{/if}
  </div>
</section>
