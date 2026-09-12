<script lang="ts">
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { currentKnowledgeId } from '@shutteros/core/services/knowledge';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  let {
    snapshot,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    dispatch: (intent: Intent) => void;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const id = $derived(currentKnowledgeId(snapshot));
  const content = $derived(id === null ? null : copy.knowledge[id]);
  const answer = $derived(snapshot.knowledge.find((item) => item.id === id));
</script>

{#if content && id}
  <div class="knowledge-check" data-knowledge={id}>
    <fieldset>
      <legend class="mb-5 text-xl font-semibold leading-snug">{content.question}</legend>
      <div class="grid gap-3">
        {#each content.choices as choice (choice.id)}
          <button
            class="knowledge-option flex items-center gap-4 rounded-lg border px-4 py-4 text-left text-base leading-snug"
            disabled={answer !== undefined}
            class:selected={answer?.answerId === choice.id}
            aria-pressed={answer?.answerId === choice.id}
            onclick={() => dispatch({ type: 'answer-check', answerId: choice.id })}
          >
            <span class="answer-indicator" aria-hidden="true"
              >{#if answer?.answerId === choice.id}<Icon name="check" size={16} />{/if}</span
            >
            <span class="flex-1">{choice.label}</span>
            {#if !answer}<Icon name="arrow" size={18} />{/if}
          </button>
        {/each}
      </div>
    </fieldset>
    {#if answer}
      <p role="status" class="mt-4 flex items-start gap-2 text-sm leading-relaxed">
        <Icon name={answer.correct ? 'check' : 'light'} size={19} />
        <span
          ><strong>{answer.correct ? copy.knowledge.correct : copy.knowledge.remember}</strong>
          {content.explanation}</span
        >
      </p>
    {:else}
      <p class="text-muted mt-3 text-xs">{copy.knowledge.optional}</p>
    {/if}
  </div>
{/if}
