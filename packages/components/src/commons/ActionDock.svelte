<script lang="ts">
  import type { Intent, Scene } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';

  type Props = {
    scene: Extract<Scene, { kind: 'challenge' }>;
    dispatch: (intent: Intent) => void;
    open: boolean;
    panelId: string;
  };

  let { scene, dispatch, open, panelId }: Props = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const content = $derived(i18n.challenges[scene.id]);
  const decision = $derived(
    scene.id === 'incident' && scene.step === 'notify' ? i18n.incidentNotify : content,
  );
  const questionId = $derived(`${panelId}-question`);
</script>

<div id={panelId} class="action-dock" hidden={!open}>
  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard users must be able to scroll this bounded region) -->
    <div
      id={`${panelId}-content`}
      class="action-dock-panel"
      tabindex="0"
      role="region"
      aria-labelledby={questionId}
    >
      <p class="eyebrow">{copy.challenge.actions}</p>
      <h2 id={questionId} class="action-dock-question">{decision.question}</h2>
      <div class="action-dock-choices">
        {#each decision.choices as choice, index (choice.id)}
          <button
            class="choice-button"
            type="button"
            data-choice={choice.id}
            onclick={() => dispatch({ type: 'choose', choiceId: choice.id })}
          >
            <span class="choice-index">{index + 1}</span>
            <span>
              <span class="block text-sm font-semibold">{choice.label}</span>
              <span class="text-muted mt-1 block text-xs leading-relaxed">{choice.detail}</span>
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .action-dock {
    width: 100%;
    height: 100%;
    min-height: 0;
    pointer-events: auto;
  }

  .action-dock-panel {
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: 100%;
    overflow: auto;
    border: 0;
    border-inline-start: 1px solid var(--line);
    background: #f7f7f5;
    color: var(--ink);
    padding: 1rem;
  }

  @media (max-width: 1099px) {
    .action-dock-panel {
      border-inline-start: 0;
      border-top: 1px solid var(--line);
    }
  }

  .action-dock-question {
    margin: 0.75rem 0 1rem;
    font-size: 1.125rem;
    font-weight: 650;
    line-height: 1.3;
  }

  .action-dock-choices {
    display: grid;
    gap: 0.5rem;
  }

  .choice-button {
    display: flex;
    border: 1px solid #527c90;
    background: #eef5f8;
    width: 100%;
    align-items: flex-start;
    gap: 0.625rem;
    border-radius: 0.5rem;
    padding: 0.75rem;
    text-align: left;
  }

  .choice-index {
    display: flex;
    height: 1.5rem;
    width: 1.5rem;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #fff;
    background: #386c83;
  }

  .choice-button:hover {
    border-color: var(--accent);
    background: #dfedf3;
  }
</style>
