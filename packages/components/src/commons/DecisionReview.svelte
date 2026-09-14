<script lang="ts">
  import {
    challengeChoiceIds,
    choiceOutcome,
    type ChallengeId,
    type DecisionStep,
  } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  let {
    id,
    step = 'choose',
    selectedChoiceId,
  }: {
    id: ChallengeId;
    step?: DecisionStep;
    selectedChoiceId: string;
  } = $props();

  const i18n = getI18n();
  const titleId = $props.id();
  const copy = $derived(i18n.text);
  const catalogChoices = $derived(
    step === 'notify' && id === 'incident'
      ? i18n.incidentNotify.choices
      : i18n.challenges[id].choices,
  );
  const choiceIds = $derived.by(() => {
    let ids = challengeChoiceIds(id, step);
    if (id === 'ai') {
      const separator = selectedChoiceId.indexOf('-');
      if (separator >= 0) {
        const tool = selectedChoiceId.slice(0, separator + 1);
        ids = ids.filter((choiceId) => choiceId.startsWith(tool));
      }
    }
    const catalogOrder = catalogChoices
      .map((choice) => choice.id as string)
      .filter((choiceId) => ids.includes(choiceId));
    return [...catalogOrder, ...ids.filter((choiceId) => !catalogOrder.includes(choiceId))];
  });
  const selectedAiTool = $derived(
    id === 'ai' && selectedChoiceId.startsWith('commercial-') ? 'commercial' : 'internal',
  );

  function choiceLabel(choiceId: string): string {
    const catalogChoice = catalogChoices.find((choice) => choice.id === choiceId);
    if (catalogChoice) return catalogChoice.label;
    if (id === 'ai') {
      const promptId = choiceId.slice(choiceId.indexOf('-') + 1) as
        'routine' | 'routineAnonymised' | 'confidential' | 'confidentialAnonymised' | 'generic';
      return copy.ai[promptId];
    }
    return choiceId;
  }
</script>

<section class="decision-review" data-activity={id} aria-labelledby={titleId}>
  <h2 id={titleId} class="decision-review-title">{copy.feedback.yourAction}</h2>
  {#if id === 'ai'}
    <p class="decision-review-context">
      <strong>{copy.ai[selectedAiTool]}</strong>
      <span>{copy.ai[`${selectedAiTool}Note`]}</span>
    </p>
  {/if}
  <ul class="decision-review-list">
    {#each choiceIds as choiceId (choiceId)}
      {@const outcome = choiceOutcome(id, step, choiceId)}
      {@const selected = choiceId === selectedChoiceId}
      {@const correct = outcome === 'safe'}
      <li
        class="decision-review-choice"
        class:selected
        data-choice={choiceId}
        data-outcome={correct ? 'correct' : 'incorrect'}
        aria-current={selected ? 'true' : undefined}
      >
        <span class="decision-review-icon">
          <Icon name={correct ? 'check' : 'close'} size={17} />
        </span>
        <span class="decision-review-label">{choiceLabel(choiceId)}</span>
        <span class="decision-review-status">
          {selected
            ? `${correct ? copy.feedback.correct : copy.feedback.incorrect} — ${copy.feedback.selected}`
            : correct
              ? `${copy.feedback.correct} — ${copy.feedback.alternative}`
              : copy.feedback.incorrect}
        </span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .decision-review {
    margin-top: 1.25rem;
  }

  .decision-review-title {
    margin-bottom: 0.625rem;
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .decision-review-list {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .decision-review-context {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
    margin: 0 0 0.625rem;
    font-size: 0.8125rem;
  }

  .decision-review-context span {
    color: var(--muted);
  }

  .decision-review-choice {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid transparent;
    border-radius: 0.55rem;
  }

  .decision-review-choice[data-outcome='correct'] {
    border-color: #a8d2b5;
    background: var(--success-soft);
    color: var(--success);
  }

  .decision-review-choice[data-outcome='incorrect'] {
    border-color: #efb5b5;
    background: #fff0f0;
    color: #922e2e;
  }

  .decision-review-choice.selected {
    border-width: 2px;
    border-color: currentColor;
    padding: calc(0.55rem - 1px) calc(0.7rem - 1px);
    box-shadow: 0 0 0 1px #ffffffb8 inset;
  }

  .decision-review-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .decision-review-label {
    min-width: 0;
    color: var(--ink);
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .decision-review-status {
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1.25;
    text-align: right;
  }

  @media (max-width: 520px) {
    .decision-review-choice {
      grid-template-columns: 1.5rem minmax(0, 1fr);
    }

    .decision-review-status {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
