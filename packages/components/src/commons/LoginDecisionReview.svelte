<script lang="ts">
  import type { LoginChoiceId } from '@shutteros/core/model/game';
  import { loginChoiceOutcome } from '@shutteros/core/services/passwords';
  import { getI18n } from '../i18n/context';
  import ChoiceReview from './ChoiceReview.svelte';

  let { selectedChoiceId }: { selectedChoiceId: LoginChoiceId } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const choices = $derived(
    copy.login.guidedChoices.map((choice) => {
      const correct = loginChoiceOutcome(choice.id) === 'safe';
      const selected = choice.id === selectedChoiceId;
      return {
        ...choice,
        correct,
        status: selected
          ? `${correct ? copy.feedback.correct : copy.feedback.incorrect} — ${copy.feedback.selected}`
          : correct
            ? `${copy.feedback.correct} — ${copy.feedback.alternative}`
            : copy.feedback.incorrect,
      };
    }),
  );
</script>

<ChoiceReview
  class="login-decision-review"
  title={copy.feedback.yourAction}
  {choices}
  {selectedChoiceId}
/>
