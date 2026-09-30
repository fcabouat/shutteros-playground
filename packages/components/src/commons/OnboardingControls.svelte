<script lang="ts">
  import type { PlayMode } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  let {
    mode,
    onMode,
    onHint,
    hintVisible = false,
    hintSeen = false,
    hintDisabled = true,
    choicesDisabled = true,
  }: {
    mode: PlayMode;
    onMode?: () => void;
    onHint?: () => void;
    hintVisible?: boolean;
    hintSeen?: boolean;
    hintDisabled?: boolean;
    choicesDisabled?: boolean;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<div class="session-controls onboarding-controls">
  <div class="session-help">
    <button class="guidance-trigger" disabled>
      <Icon name="sparkles" size={20} /><span>{copy.welcome.controls.progress}</span>
    </button>
    <button
      class="guidance-trigger"
      class:offered={hintVisible}
      disabled={hintDisabled}
      aria-pressed={hintVisible}
      onclick={onHint}
    >
      <Icon name="light" size={20} /><span
        >{hintVisible
          ? copy.challenge.hideHint
          : hintSeen
            ? copy.guidance.restore
            : copy.guidance.first}</span
      >
    </button>
    <button class="guidance-trigger choices-trigger" disabled={choicesDisabled}>
      <Icon name="checkbox" size={20} /><span>{copy.guidance.choices}</span>
    </button>
  </div>
  <div class="session-finish">
    <button
      class="finish-experience rounded-lg px-3 py-2 text-xs"
      onclick={onMode}
      disabled={!onMode}
    >
      {mode === 'guided' ? copy.experience.free : copy.experience.guided}<Icon
        name="arrow"
        size={14}
        class="ml-2 inline"
      />
    </button>
  </div>
  <span
    class="session-timer waiting flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
  >
    <Icon name="hourglass" size={17} /><span>{copy.welcome.controls.waiting}</span>
  </span>
</div>
