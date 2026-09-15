<script lang="ts">
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { currentKnowledgeId, knowledgeAnswer } from '@shutteros/core/services/knowledge';
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

  function isCorrect(choiceId: string): boolean {
    return id !== null && knowledgeAnswer(id, choiceId)?.correct === true;
  }
</script>

{#if content && id}
  <div class="knowledge-check" data-knowledge={id}>
    <fieldset>
      <legend class="mb-5 text-xl font-semibold leading-snug">{content.question}</legend>
      <div class="grid gap-3">
        {#each content.choices as choice (choice.id)}
          {@const evaluated = answer !== undefined}
          {@const correct = isCorrect(choice.id)}
          {@const selected = answer?.answerId === choice.id}
          <button
            class="knowledge-option grid items-center gap-3 rounded-lg border px-4 py-4 text-left text-base leading-snug"
            disabled={evaluated}
            class:selected
            data-choice={choice.id}
            data-outcome={evaluated ? (correct ? 'correct' : 'incorrect') : undefined}
            aria-pressed={selected}
            onclick={() => dispatch({ type: 'answer-check', answerId: choice.id })}
          >
            <span class="answer-indicator" aria-hidden="true"
              >{#if evaluated}<Icon name={correct ? 'check' : 'close'} size={16} />{/if}</span
            >
            <span class="flex-1">{choice.label}</span>
            {#if evaluated}
              <span class="knowledge-option-status">
                {selected
                  ? `${correct ? copy.feedback.correct : copy.feedback.incorrect} — ${copy.feedback.selected}`
                  : correct
                    ? `${copy.feedback.correct} — ${copy.feedback.alternative}`
                    : copy.feedback.incorrect}
              </span>
            {:else}<Icon name="arrow" size={18} />{/if}
          </button>
        {/each}
      </div>
    </fieldset>
    {#if answer}
      <p
        role="status"
        class="knowledge-explanation mt-5 flex items-start gap-3 text-sm leading-relaxed"
      >
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

<style>
  .knowledge-option {
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    background: #edf4f8;
    border-color: #527c90;
    color: var(--ink);
  }

  .knowledge-option:hover:not(:disabled) {
    background: #dfedf3;
    border-color: var(--accent);
  }

  .knowledge-option[data-outcome='correct'] {
    border-color: #a8d2b5;
    background: var(--success-soft);
    color: var(--success);
  }

  .knowledge-option[data-outcome='incorrect'] {
    border-color: #efb5b5;
    background: #fff0f0;
    color: #922e2e;
  }

  .knowledge-option:disabled {
    cursor: default;
    opacity: 1;
  }

  .knowledge-option.selected {
    border-width: 2px;
    border-color: currentColor;
    padding: calc(1rem - 1px);
    box-shadow: 0 0 0 1px #ffffffb8 inset;
  }

  .answer-indicator {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    align-items: center;
    justify-content: center;
    border: 2px solid currentColor;
    border-radius: 50%;
    background: white;
  }

  .knowledge-option-status {
    max-width: 11rem;
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1.25;
    text-align: right;
  }

  @media (max-width: 520px) {
    .knowledge-option:disabled {
      align-items: start;
      grid-template-columns: 1.5rem minmax(0, 1fr);
    }

    .knowledge-option-status {
      width: 100%;
      max-width: none;
      grid-column: 2;
      text-align: left;
    }
  }
</style>
