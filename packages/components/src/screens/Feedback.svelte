<script lang="ts">
  import {
    choiceOutcome,
    type GameState,
    type ChallengeResult,
    type Intent,
  } from '@shutteros/core/model/game';
  import {
    experienceComplete,
    incidentFollowsFeedback,
    resultAssessment,
  } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const challenges = $derived(i18n.challenges);
  const copy = $derived(i18n.text);
  import Icon from '../commons/Icon.svelte';
  import AiPolicy from '../commons/AiPolicy.svelte';
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
  const assessment = $derived(resultAssessment(result));
  const decisionStep = $derived(
    choiceOutcome(result.id, 'notify', result.choiceId) === null ? 'choose' : 'notify',
  );
</script>

<section
  class="feedback-card flex w-full flex-col"
  class:simulated-incident={result.id === 'usb' && assessment === 'risky'}
  data-outcome={assessment}
>
  <div class="feedback-content">
    <div class="p-5 sm:p-7">
      <div class="reading-column">
        <LearningPanel
          lesson={content.lesson}
          emphasis={content.lessonEmphasis}
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
          <div class="feedback-heading">
            <div class="feedback-icon flex h-11 w-11 items-center justify-center rounded-2xl">
              <Icon
                name={assessment === 'safe'
                  ? 'secure'
                  : assessment === 'caution' || (result.id === 'usb' && assessment === 'risky')
                    ? 'incident'
                    : 'light'}
                size={28}
              />
            </div>
            <h1 class="text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight">
              {result.id === 'usb' && assessment === 'risky'
                ? copy.feedback.simulatedIncident
                : assessment === 'caution'
                  ? copy.feedback.caution
                  : result.id === 'mfa' && result.choiceId === 'ignore'
                    ? copy.feedback.mfaIgnoredTitle
                    : copy.feedback[result.outcome]}
            </h1>
          </div>
          {#if result.id === 'ai'}<AiPolicy reread />{/if}
          {#if result.priorChoiceId}
            <DecisionReview id={result.id} step="choose" selectedChoiceId={result.priorChoiceId} />
          {/if}
          <DecisionReview id={result.id} step={decisionStep} selectedChoiceId={result.choiceId} />
          <p class="feedback-explanation text-muted text-sm leading-relaxed">
            {assessment === 'caution'
              ? result.choiceId === 'eject'
                ? copy.usb.ejectedAfterReadme
                : copy.usb.recoveredAfterReadme
              : result.id === 'ai' && Object.hasOwn(copy.ai.feedback, result.choiceId)
                ? copy.ai.feedback[result.choiceId as keyof typeof copy.ai.feedback]
                : result.id === 'mfa' && result.choiceId === 'ignore'
                  ? copy.feedback.mfaIgnored
                  : result.id === 'mail' && result.choiceId === 'report'
                    ? copy.mail.reported
                    : result.id === 'usb' && result.choiceId === 'eject'
                      ? copy.usb.ejected
                      : content.feedback[result.outcome]}
          </p>
          {#if replay}<p class="text-muted text-xs leading-relaxed">
              {copy.feedback.replay}
            </p>{/if}
        </LearningPanel>
      </div>
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

<style>
  .feedback-card[data-outcome='caution'] .feedback-icon {
    background: var(--warning-soft);
    color: var(--warning);
  }
  .feedback-card.simulated-incident .feedback-icon {
    background: #fde8e7;
    color: #a32924;
  }
</style>
