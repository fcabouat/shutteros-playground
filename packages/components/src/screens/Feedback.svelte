<script lang="ts">
  import {
    choiceOutcome,
    type GameState,
    type ChallengeResult,
    type Intent,
  } from '@shutteros/core/model/game';
  import { experienceComplete, incidentFollowsFeedback } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const challenges = $derived(i18n.challenges);
  const copy = $derived(i18n.text);
  import Icon from '../commons/Icon.svelte';
  import DecisionReview from '../commons/DecisionReview.svelte';
  import LearningPanel from '../commons/LearningPanel.svelte';
  let {
    snapshot,
    result,
    replay,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    result: ChallengeResult;
    replay: boolean;
    dispatch: (intent: Intent) => void;
  } = $props();
  const content = $derived(challenges[result.id]);
  const infection = $derived(incidentFollowsFeedback(snapshot, result));
  const decisionStep = $derived(
    choiceOutcome(result.id, 'notify', result.choiceId) === null ? 'choose' : 'notify',
  );
</script>

<section class="feedback-card flex w-full flex-col" data-outcome={result.outcome}>
  <div class="feedback-content p-5 sm:p-7">
    <div class="reading-column">
      <LearningPanel
        lesson={content.lesson}
        points={[
          ...copy.education[result.id],
          ...(result.id === 'usb'
            ? [copy.usb.warning, copy.usb.reminder]
            : result.id === 'mail' || result.id === 'spoof'
              ? [copy.mail.signatureNuance]
              : result.id === 'mfa'
                ? [copy.mfa.noGeoProof]
                : []),
        ]}
        {snapshot}
        {dispatch}
      >
        <div class="feedback-icon mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon name={result.outcome === 'safe' ? 'secure' : 'light'} size={28} />
        </div>
        <h1 class="text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight">
          {result.id === 'mfa' && result.choiceId === 'ignore'
            ? copy.feedback.mfaIgnoredTitle
            : copy.feedback[result.outcome]}
        </h1>
        {#if result.priorChoiceId}
          <DecisionReview id={result.id} step="choose" selectedChoiceId={result.priorChoiceId} />
        {/if}
        <DecisionReview id={result.id} step={decisionStep} selectedChoiceId={result.choiceId} />
        <p class="text-muted mt-3 text-sm leading-relaxed">
          {result.id === 'ai' && Object.hasOwn(copy.ai.feedback, result.choiceId)
            ? copy.ai.feedback[result.choiceId as keyof typeof copy.ai.feedback]
            : result.id === 'mfa' && result.choiceId === 'ignore'
              ? copy.feedback.mfaIgnored
              : result.id === 'mail' && result.choiceId === 'report'
                ? copy.mail.reported
                : result.id === 'usb' && result.choiceId === 'eject'
                  ? copy.usb.ejected
                  : content.feedback[result.outcome]}
        </p>
        {#if replay}<p class="text-muted mt-3 text-xs leading-relaxed">
            {copy.feedback.replay}
          </p>{/if}
      </LearningPanel>
    </div>
  </div>
  <footer class="shrink-0 border-t border-[var(--line)] px-5 py-4 sm:px-7">
    <div class="reading-column">
      <button class="button button-primary" onclick={() => dispatch({ type: 'continue' })}
        >{snapshot.mode === 'guided'
          ? copy.experience.next
          : infection
            ? copy.feedback.incident
            : experienceComplete(snapshot)
              ? copy.feedback.finish
              : copy.feedback.continue}<Icon name="arrow" size={18} /></button
      >
    </div>
  </footer>
</section>
