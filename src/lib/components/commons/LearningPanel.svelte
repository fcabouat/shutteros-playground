<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { currentKnowledgeId } from '@shutteros/core/services/knowledge';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';
  import KnowledgeCheck from './KnowledgeCheck.svelte';
  import { focusScreen } from './focus';

  let {
    lesson,
    points,
    snapshot,
    dispatch,
    children,
  }: {
    lesson: string;
    points: readonly string[];
    snapshot: Extract<GameState, { phase: 'session' }>;
    dispatch: (intent: Intent) => void;
    children?: Snippet;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let page = $state<'lesson' | 'details' | 'check'>('lesson');
</script>

<div class="learning-panel outline-none" tabindex="-1" use:focusScreen={page}>
  {#if page === 'lesson'}
    {@render children?.()}
    <p
      class="learning-takeaway my-5 border-l-4 border-[var(--accent)] pl-4 text-base leading-relaxed"
    >
      {lesson}
    </p>
    <div class="flex flex-wrap gap-3">
      <button class="button button-text" onclick={() => (page = 'details')}
        >{copy.education.more}<Icon name="arrow" size={16} /></button
      >
      {#if currentKnowledgeId(snapshot)}<button
          class="button button-soft"
          onclick={() => (page = 'check')}
          >{copy.routines.check}<Icon name="arrow" size={16} /></button
        >{/if}
    </div>
  {:else}
    <button class="text-link mb-5 flex items-center gap-2 text-sm" onclick={() => (page = 'lesson')}
      ><Icon name="back" size={16} />{copy.knowledge.back}</button
    >
    {#if page === 'details'}
      <h2 class="mb-5 text-xl font-semibold">{copy.education.more}</h2>
      <ul class="list-disc space-y-4 pl-5 text-sm leading-relaxed">
        {#each points as point (point)}<li>{point}</li>{/each}
      </ul>
    {:else}<KnowledgeCheck {snapshot} {dispatch} />{/if}
  {/if}
</div>
