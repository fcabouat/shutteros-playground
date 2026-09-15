<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { Intent, GameState } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';
  import EmphasizedText from '../commons/EmphasizedText.svelte';
  let {
    snapshot,
    dispatch,
  }: { snapshot: Extract<GameState, { phase: 'session' }>; dispatch: (intent: Intent) => void } =
    $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<section class="intro-card p-5 sm:p-6">
  <div class="reading-column">
    <span class="intro-visual mb-3 inline-flex rounded-xl p-3"><Icon name="key" size={28} /></span>
    <h1 class="text-2xl leading-tight font-semibold tracking-tight">{copy.intro.title}</h1>
    <p class="text-muted mt-3 text-sm leading-relaxed">
      {snapshot.loginCategory === 'weak' ? copy.intro.guessedDescription : copy.intro.description}
    </p>
    <p class="mt-4 text-sm leading-relaxed">
      <EmphasizedText text={copy.intro.principle} emphasis={copy.intro.principleEmphasis} />
    </p>
    <button class="button button-primary mt-5" onclick={() => dispatch({ type: 'continue' })}
      >{copy.intro.start}<Icon name="arrow" size={18} /></button
    >
  </div>
</section>
