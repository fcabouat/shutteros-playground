<script lang="ts">
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  let {
    snapshot,
    dispatch,
  }: { snapshot: Extract<GameState, { phase: 'session' }>; dispatch: (intent: Intent) => void } =
    $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<section class="p-5 sm:p-7">
  <div class="reading-column wide">
    <h1 class="text-2xl font-semibold">{copy.routines.title}</h1>
    <p class="text-muted mt-2 text-sm">{copy.routines.subtitle}</p>
    <div class="routine-grid mt-6 grid gap-6 md:grid-cols-3">
      {#each ['password', 'update', 'lock'] as item (item)}
        {@const id = item as 'password' | 'update' | 'lock'}
        {@const done =
          id === 'lock'
            ? snapshot.routines.lockPracticed
            : id === 'password'
              ? snapshot.routines.password === 'done'
              : snapshot.routines.update === 'scheduled'}
        <article class="routine-item flex flex-col" data-routine={id}>
          <Icon name={id === 'password' ? 'key' : id === 'update' ? 'monitor' : 'lock'} size={26} />
          <h2 class="mt-4 min-h-[3rem] text-lg leading-snug font-semibold">{copy.routines[id]}</h2>
          <p class="text-muted mt-3 grow text-sm leading-relaxed">{copy.routines[`${id}Body`]}</p>
          {#if done}<p class="lesson-box mt-4 rounded-lg p-3 text-sm" role="status">
              <strong>{copy.routines[`${id}Done`]}</strong>{#if id !== 'lock'}<span
                  class="mt-2 block leading-relaxed">{copy.routines[`${id}Lesson`]}</span
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
    {#if snapshot.scene.kind === 'routines'}<footer class="mt-7 border-t border-[var(--line)] pt-5">
        <button class="button button-primary" onclick={() => dispatch({ type: 'continue' })}
          >{copy.experience.review}<Icon name="arrow" size={17} /></button
        >
      </footer>{/if}
  </div>
</section>
