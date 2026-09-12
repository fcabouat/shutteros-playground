<script lang="ts">
  import type { GameState, ChallengeResult, Intent } from '@shutteros/core/model/game';
  import { challengeOrder } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const challenges = $derived(i18n.challenges);
  const copy = $derived(i18n.text);
  import Icon from '../commons/Icon.svelte';
  import LearningPanel from '../commons/LearningPanel.svelte';
  let {
    snapshot,
    result,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    result: ChallengeResult;
    dispatch: (intent: Intent) => void;
  } = $props();
  const content = $derived(challenges[result.id]);
  const infection = $derived(
    result.id === 'usb' &&
      result.outcome === 'risky' &&
      !snapshot.results.some((r) => r.id === 'incident'),
  );
</script>

<section class="feedback-card flex w-full flex-col" data-outcome={result.outcome}>
  <div class="feedback-content p-5 sm:p-7">
    <div class="reading-column">
      <LearningPanel
        lesson={content.lesson}
        points={copy.education[result.id]}
        {snapshot}
        {dispatch}
      >
        <div class="feedback-icon mb-4 flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon
            name={result.outcome === 'safe'
              ? 'secure'
              : result.outcome === 'timeout'
                ? 'hourglass'
                : 'light'}
            size={28}
          />
        </div>
        <h1 class="text-[clamp(1.5rem,3vw,2rem)] leading-tight font-semibold tracking-tight">
          {copy.feedback[result.outcome]}
        </h1>
        <p class="text-muted mt-3 text-sm leading-relaxed">{content.feedback[result.outcome]}</p>
        {#if result.outcome === 'timeout'}<p class="text-muted mt-3 text-sm leading-relaxed">
            {copy.feedback.timeoutDetail}
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
            : snapshot.results.length === challengeOrder.length
              ? copy.feedback.finish
              : copy.feedback.continue}<Icon name="arrow" size={18} /></button
      >
    </div>
  </footer>
</section>
