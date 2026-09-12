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
  const scheduled = $derived(snapshot.routines.update === 'scheduled');
</script>

<section
  class="updates-screen mx-auto w-full max-w-[760px] p-5 sm:p-7"
  aria-labelledby="updates-title"
>
  <div class="flex items-start gap-4">
    <span class="app-icon" data-app="monitor"><Icon name="monitor" size={25} /></span>
    <div class="min-w-0">
      <h1 id="updates-title" class="text-2xl font-semibold tracking-tight">
        {copy.routines.updates}
      </h1>
      <p class="text-muted mt-2 text-sm leading-relaxed">{copy.routines.updateBody}</p>
    </div>
  </div>

  <div class="update-card mt-6 rounded-xl border border-[var(--line)] p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="update-status flex h-9 w-9 items-center justify-center rounded-full"
        ><Icon name={scheduled ? 'check' : 'monitor'} size={18} /></span
      >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold" role="status">
          {scheduled ? copy.routines.updateDone : copy.routines.update}
        </p>
        <p class="text-muted mt-1 text-xs">
          {scheduled ? copy.routines.updateLesson : copy.routines.updateReady}
        </p>
      </div>
      {#if !scheduled}
        <button
          class="button button-primary shrink-0"
          type="button"
          onclick={() => dispatch({ type: 'routine', id: 'update', action: 'complete' })}
          >{copy.routines.updateAction}</button
        >
      {/if}
    </div>
  </div>
</section>

<style>
  .update-status {
    color: var(--accent-strong);
    background: var(--soft);
  }
  .update-card {
    background: color-mix(in srgb, var(--surface) 92%, var(--soft));
  }
  @media (max-width: 640px) {
    .update-card > div {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .update-card button {
      margin-left: 48px;
      width: calc(100% - 48px);
    }
  }
</style>
