<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { Intent, GameState } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Icon from '../commons/Icon.svelte';
  import { loginChoiceOutcome } from '@shutteros/core/services/passwords';
  import EmphasizedText from '../commons/EmphasizedText.svelte';
  import LoginDecisionReview from '../commons/LoginDecisionReview.svelte';
  let {
    snapshot,
    config,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
  } = $props();
  const i18n = getI18n();
  const titleId = $props.id();
  const copy = $derived(i18n.text);
</script>

<section class="intro-card">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (This bounded reading region needs keyboard focus for scrolling.) -->
  <div class="learning-scroll" role="region" aria-labelledby={titleId} tabindex="0">
    <div class="w-full p-5 sm:p-6">
      <div class="reading-column">
        <span class="intro-visual mb-3 inline-flex rounded-xl p-3"
          ><Icon name="key" size={28} /></span
        >
        {#if snapshot.loginCategory === 'guided' && snapshot.loginChoiceId}
          <p class="activity-family" data-family="protection">
            <Icon name="secure" size={14} />
            {copy.guidance.families.protection}
          </p>
          <h1 id={titleId} class="mt-3 text-2xl leading-tight font-semibold tracking-tight">
            {loginChoiceOutcome(snapshot.loginChoiceId) === 'safe'
              ? copy.intro.guidedTitle
              : copy.intro.guidedRiskTitle}
          </h1>
          <LoginDecisionReview selectedChoiceId={snapshot.loginChoiceId} />
          <p class="text-muted mt-3 text-sm leading-relaxed">
            {snapshot.loginChoiceId === 'manager'
              ? copy.intro.guidedSafe(config.passwordManagerName)
              : snapshot.loginChoiceId === 'note'
                ? copy.intro.guidedRiskNote(config.passwordManagerName)
                : copy.intro.guidedRiskFile(config.passwordManagerName)}
          </p>
          <p class="mt-4 text-sm leading-relaxed">{copy.intro.guidedTransition}</p>
        {:else}
          <h1 id={titleId} class="text-2xl leading-tight font-semibold tracking-tight">
            {copy.intro.title}
          </h1>
          <p class="text-muted mt-3 text-sm leading-relaxed">
            {snapshot.loginCategory === 'weak'
              ? copy.intro.guessedDescription
              : copy.intro.description}
          </p>
          <p class="mt-4 text-sm leading-relaxed">
            <EmphasizedText
              text={copy.intro.principle(config.passwordManagerName)}
              emphasis={copy.intro.principleEmphasis(config.passwordManagerName)}
            />
          </p>
        {/if}
        <aside class="manager-context mt-5 rounded-xl p-4 text-sm leading-relaxed">
          <p>{copy.intro.managerUnlock(config.passwordManagerName)}</p>
          {#if config.passwordManagerName === 'KeePassXC'}
            <p class="mt-2">{copy.intro.keepassxcCertification}</p>
          {/if}
          <p class="mt-2">{copy.intro.keepassdx}</p>
        </aside>
      </div>
    </div>
  </div>
  <footer class="shrink-0 border-t border-[var(--line)] px-5 py-4 sm:px-7">
    <div class="window-actions">
      <button class="button button-primary" onclick={() => dispatch({ type: 'continue' })}
        >{snapshot.mode === 'guided' ? copy.intro.guidedStart : copy.intro.start}<Icon
          name="arrow"
          size={18}
        /></button
      >
    </div>
  </footer>
</section>

<style>
  :global(.window-body:has(> .intro-card)) {
    display: flex;
    overflow: hidden;
  }
  .intro-card {
    flex: 1;
    min-height: 0;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  .learning-scroll {
    display: flex;
    flex: 1;
    min-height: 0;
    align-items: safe center;
    overflow-y: auto;
  }
  footer {
    background: var(--surface);
  }
  .manager-context {
    color: var(--accent-strong);
    background: var(--soft);
    border: 1px solid #d1e2e7;
  }
</style>
