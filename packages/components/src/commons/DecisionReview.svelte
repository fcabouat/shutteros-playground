<script lang="ts">
  import {
    challengeChoiceIds,
    choiceOutcome,
    type AiPrompt,
    type ChallengeId,
    type DecisionStep,
  } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import ChoiceReview from './ChoiceReview.svelte';

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
    if (id === 'ai') {
      const promptId = choiceId.slice(choiceId.indexOf('-') + 1) as AiPrompt;
      return copy.ai.review[promptId];
    }
    return catalogChoices.find((choice) => choice.id === choiceId)?.label ?? choiceId;
  }

  function otherToolNote(choiceId: string): string | null {
    if (id !== 'ai') return null;
    const otherTool = selectedAiTool === 'internal' ? 'commercial' : 'internal';
    const promptId = choiceId.slice(choiceId.indexOf('-') + 1);
    const alternative = choiceOutcome('ai', step, `${otherTool}-${promptId}`);
    return alternative !== choiceOutcome('ai', step, choiceId)
      ? copy.ai.otherTool[otherTool]
      : null;
  }

  function highlightedLabel(
    choiceId: string,
  ): { before: string; match: string; after: string } | null {
    if (
      id !== 'ai' ||
      (!choiceId.endsWith('-confidential') && !choiceId.endsWith('-confidentialAnonymised'))
    )
      return null;
    const label = choiceLabel(choiceId);
    const marker = copy.ai.securityMarker;
    const index = label
      .toLocaleLowerCase(i18n.locale)
      .indexOf(marker.toLocaleLowerCase(i18n.locale));
    return index < 0
      ? null
      : {
          before: label.slice(0, index),
          match: label.slice(index, index + marker.length),
          after: label.slice(index + marker.length),
        };
  }

  const reviewChoices = $derived(
    choiceIds.map((choiceId) => {
      const correct = choiceOutcome(id, step, choiceId) === 'safe';
      const selected = choiceId === selectedChoiceId;
      return {
        id: choiceId,
        label: choiceLabel(choiceId),
        correct,
        note: otherToolNote(choiceId),
        highlight: highlightedLabel(choiceId),
        status: selected
          ? `${correct ? copy.feedback.correct : copy.feedback.incorrect} — ${copy.feedback.selected}`
          : correct
            ? `${copy.feedback.correct} — ${copy.feedback.alternative}`
            : copy.feedback.incorrect,
      };
    }),
  );
  const context = $derived(
    id === 'ai'
      ? { title: copy.ai[selectedAiTool], detail: copy.ai[`${selectedAiTool}Note`] }
      : undefined,
  );
</script>

<ChoiceReview
  title={copy.feedback.yourAction}
  choices={reviewChoices}
  {selectedChoiceId}
  {context}
  activity={id}
/>
