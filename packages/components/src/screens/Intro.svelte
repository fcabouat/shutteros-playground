<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { Intent, GameState } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Icon from '../commons/Icon.svelte';
  import { loginChoiceOutcome } from '@shutteros/core/services/passwords';
  import EmphasizedText from '../commons/EmphasizedText.svelte';
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
  const copy = $derived(i18n.text);
</script>

<section class="intro-card p-5 sm:p-6">
  <div class="reading-column">
    <span class="intro-visual mb-3 inline-flex rounded-xl p-3"><Icon name="key" size={28} /></span>
    {#if snapshot.loginCategory === 'guided' && snapshot.loginChoiceId}
      <p class="activity-family" data-family="protection">
        <Icon name="secure" size={14} />
        {copy.guidance.families.protection}
      </p>
      <h1 class="mt-3 text-2xl leading-tight font-semibold tracking-tight">
        {loginChoiceOutcome(snapshot.loginChoiceId) === 'safe'
          ? copy.intro.guidedTitle
          : copy.intro.guidedRiskTitle}
      </h1>
      <p class="text-muted mt-3 text-sm leading-relaxed">
        {snapshot.loginChoiceId === 'manager'
          ? copy.intro.guidedSafe(config.passwordManagerName)
          : snapshot.loginChoiceId === 'note'
            ? copy.intro.guidedRiskNote(config.passwordManagerName)
            : copy.intro.guidedRiskFile(config.passwordManagerName)}
      </p>
      <p class="mt-4 text-sm leading-relaxed">{copy.intro.guidedTransition}</p>
    {:else}
      <h1 class="text-2xl leading-tight font-semibold tracking-tight">{copy.intro.title}</h1>
      <p class="text-muted mt-3 text-sm leading-relaxed">
        {snapshot.loginCategory === 'weak' ? copy.intro.guessedDescription : copy.intro.description}
      </p>
      <p class="mt-4 text-sm leading-relaxed">
        <EmphasizedText
          text={copy.intro.principle(config.passwordManagerName)}
          emphasis={copy.intro.principleEmphasis(config.passwordManagerName)}
        />
      </p>
    {/if}
    <button class="button button-primary mt-5" onclick={() => dispatch({ type: 'continue' })}
      >{copy.intro.start}<Icon name="arrow" size={18} /></button
    >
  </div>
</section>
