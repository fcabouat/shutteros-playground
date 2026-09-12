<script lang="ts">
  import { tick } from 'svelte';
  import type { GameState, Intent, Scene } from '@shutteros/core/model/game';
  import { remainingSeconds, explorationReady } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  type Props = {
    snapshot: Extract<GameState, { phase: 'session' }>;
    scene: Extract<Scene, { kind: 'challenge' }>;
    dispatch: (intent: Intent) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

  let { snapshot, scene, dispatch, open, onOpenChange }: Props = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  const content = $derived(i18n.challenges[scene.id]);
  const decision = $derived(
    scene.id === 'incident' && scene.step === 'notify' ? i18n.incidentNotify : content,
  );
  const seconds = $derived(
    scene.deadline === null ? null : remainingSeconds(scene.deadline, snapshot.now),
  );
  const panelId = $props.id();
  let panel = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();
  let hintOpen = $state(false);

  // The expanded panel and collapsed trigger are alternative DOM branches. Wait for
  // their mount before moving focus, including when collapsing by keyboard.
  $effect(() => {
    if (!open) return;
    void tick().then(() => panel?.focus({ preventScroll: true }));
  });

  async function collapse() {
    onOpenChange(false);
    await tick();
    trigger?.focus({ preventScroll: true });
  }
</script>

<div class:collapsed={!open} class="action-dock">
  {#if open}
    <aside
      bind:this={panel}
      id={panelId}
      class="action-dock-panel"
      role="region"
      aria-label={copy.challenge.actions}
      tabindex="-1"
    >
      <div class="action-dock-header">
        <p class="eyebrow">{copy.challenge.actions}</p>
        <button
          class="icon-button"
          type="button"
          onclick={collapse}
          aria-label={copy.challenge.collapseActions}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {#if seconds !== null}
        <p class="qte-time" aria-label={copy.challenge.countdown}>
          {copy.challenge.seconds(seconds)}
        </p>
      {/if}

      <h2 class="action-dock-question">{decision.question}</h2>
      <div class="action-dock-choices">
        {#each decision.choices as choice, index (choice.id)}
          <button
            class="choice-button"
            type="button"
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

      <button
        class="text-link action-dock-hint"
        type="button"
        aria-expanded={hintOpen}
        onclick={() => (hintOpen = !hintOpen)}
      >
        <Icon name="light" size={16} />{hintOpen
          ? copy.challenge.hideHint
          : scene.id === 'web'
            ? copy.web.inspect
            : copy.challenge.hint}
      </button>
      {#if hintOpen}<p class="text-muted action-dock-hint-copy">
          {scene.id === 'web' ? copy.web.inspector : content.hints[1]}
        </p>{/if}
    </aside>
  {:else}
    <button
      bind:this={trigger}
      class="button button-lime action-dock-trigger"
      class:ready={explorationReady(snapshot)}
      title={explorationReady(snapshot) ? copy.experience.ready : copy.experience.explore}
      type="button"
      aria-expanded="false"
      onclick={() => onOpenChange(true)}
    >
      {copy.challenge.actions}<Icon name="arrow" size={16} />
    </button>
  {/if}
</div>

<style>
  .action-dock {
    position: fixed;
    right: 20px;
    bottom: 84px;
    z-index: 35;
    width: 352px;
    max-height: calc(100dvh - 160px);
  }

  .action-dock.collapsed {
    width: auto;
  }

  .action-dock-panel {
    max-height: calc(100dvh - 160px);
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #f7f7f5;
    color: var(--ink);
    box-shadow: 0 18px 46px #17233045;
    padding: 1rem;
  }

  .action-dock-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .qte-time {
    margin-top: 0.75rem;
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
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
    border: 1px solid #a7c1cd;
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
  }

  .action-dock-hint {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .action-dock-hint-copy {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .action-dock-trigger.ready {
    box-shadow:
      0 0 0 3px #c2f29a35,
      0 4px 18px #00152b35;
  }

  .action-dock-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  @media (max-width: 680px) {
    .action-dock {
      right: 12px;
      bottom: 76px;
      width: min(352px, calc(100vw - 24px));
    }
  }
</style>
