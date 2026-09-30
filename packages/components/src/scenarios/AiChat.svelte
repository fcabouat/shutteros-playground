<script lang="ts">
  import type { AiPrompt, AiTool, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  import AiPolicy from '../commons/AiPolicy.svelte';

  let { guided = false, dispatch }: { guided?: boolean; dispatch: (intent: Intent) => void } =
    $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text.ai);
  // Interleave drafts without grouping them by outcome. Both modes submit the
  // same pair to the core, and keep the draft when the player switches modes.
  const promptOptions = [
    'confidentialAnonymised',
    'routine',
    'generic',
    'confidential',
    'routineAnonymised',
  ] as const satisfies readonly AiPrompt[];
  let tool = $state<AiTool>('internal');
  let prompt = $state<AiPrompt | null>(null);
  const preview = $derived(prompt === null ? '' : copy[`${prompt}Prompt`]);
</script>

<section class="ai-chat" class:ai-questionnaire={guided} aria-label={copy.app}>
  <header class="ai-toolbar">
    <fieldset class="ai-workspace" data-hint-target="tool">
      <legend class="sr-only">{copy.tools}</legend>
      <div class="ai-tools">
        {#each ['internal', 'commercial'] as value (value)}
          {@const id = value as AiTool}
          <label class="ai-tool" class:chosen={tool === id}>
            <input type="radio" name="ai-tool" value={id} bind:group={tool} />
            <span>{copy[id]}</span>
          </label>
        {/each}
      </div>
      <p class="text-muted mt-2 text-xs">{copy[`${tool}Note`]}</p>
    </fieldset>
    <AiPolicy hintTarget />
  </header>
  <div class="ai-content">
    {#if guided}
      <h2 class="ai-question">{i18n.challenges.ai.question}</h2>
    {:else}
      <div class="ai-greeting">
        <span class="ai-avatar"><Icon name="ai" size={22} /></span>
        <div>
          <p>{copy.welcome}</p>
          <span class="ai-waiting" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
      </div>
    {/if}
    <div class="ai-composer">
      <fieldset>
        <legend>{copy.choosePrompt}</legend>
        <div class="ai-prompts">
          {#each promptOptions as id, index (id)}
            <label class="ai-prompt" class:chosen={prompt === id} data-choice={`${tool}-${id}`}>
              <input
                type="radio"
                name="ai-prompt"
                value={id}
                bind:group={prompt}
                aria-label={copy[id]}
              />
              {#if guided}<span class="ai-choice-index" aria-hidden="true">{index + 1}</span>{/if}
              <span>
                <span class="ai-prompt-label">{copy[id]}</span>
                {#if guided}<span class="ai-prompt-detail">{copy[`${id}Prompt`]}</span>{/if}
              </span>
            </label>
          {/each}
        </div>
      </fieldset>
      {#if !guided}
        <div class="ai-draft">
          <p class="text-muted mb-2 text-xs font-semibold">{copy.preview}</p>
          <p class="ai-preview" aria-live="polite">{preview || copy.empty}</p>
        </div>
      {/if}
      <div class="ai-send-row">
        <p class="text-muted text-xs">{copy.fiction}</p>
        <button
          class="button button-primary"
          disabled={prompt === null}
          onclick={() => {
            if (prompt !== null) dispatch({ type: 'send-ai', tool, prompt });
          }}>{guided ? copy.confirm : copy.send}<Icon name="spoof" size={17} /></button
        >
      </div>
    </div>
  </div>
</section>

<style>
  .ai-chat {
    background: #f1f5f7;
    color: var(--ink);
  }
  .ai-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    background: #fff;
  }
  .ai-toolbar :global(.ai-policy) {
    flex-basis: 100%;
  }
  .ai-content {
    width: 100%;
    max-width: 1120px;
    margin: auto;
    padding: 1rem;
  }
  fieldset {
    min-width: 0;
  }
  legend {
    margin-bottom: 0.625rem;
    font-size: 0.8125rem;
    font-weight: 650;
  }
  .ai-tools,
  .ai-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .ai-tool,
  .ai-prompt {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid #9bafb9;
    border-radius: 0.625rem;
    background: white;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .chosen {
    border-color: var(--accent);
    background: #e4f0f4;
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  input {
    accent-color: var(--accent);
    flex: none;
  }
  .ai-greeting {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
    background: white;
    border: 1px solid var(--line);
    border-radius: 1rem 1rem 1rem 0.25rem;
    font-size: 0.9375rem;
  }
  .ai-avatar {
    display: inline-flex;
    padding: 0.5rem;
    border-radius: 0.75rem;
    background: #e4f0f4;
    color: var(--accent);
  }
  .ai-waiting {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.75rem;
  }
  .ai-waiting i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #607786;
    animation: ai-wait 1.5s ease-in-out 3;
  }
  .ai-waiting i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .ai-waiting i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes ai-wait {
    50% {
      opacity: 0.35;
      transform: translateY(-2px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ai-waiting i {
      animation: none;
    }
  }
  .ai-composer {
    margin-top: 0.75rem;
    padding: 1rem;
    background: white;
    border: 1px solid var(--line);
    border-radius: 1rem;
    box-shadow: 0 3px 12px #17233008;
  }
  .ai-draft {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--line);
  }
  .ai-preview {
    min-height: 4rem;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .ai-send-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 1rem;
  }
  .ai-question {
    margin-top: 0;
    font-size: 1.25rem;
    line-height: 1.4;
    font-weight: 650;
  }
  .ai-questionnaire .ai-composer {
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
  }
  .ai-questionnaire .ai-content {
    max-width: 1280px;
  }
  .ai-questionnaire .ai-prompts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  }
  .ai-questionnaire .ai-prompt {
    align-items: flex-start;
    padding: 0.875rem;
  }
  .ai-questionnaire input {
    margin-top: 0.2rem;
  }
  .ai-questionnaire .ai-prompt-label {
    font-weight: 650;
  }
  .ai-prompt-detail {
    display: block;
    margin-top: 0.375rem;
    color: var(--muted);
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  .ai-choice-index {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.375rem;
    color: white;
    background: #386c83;
    font-size: 0.75rem;
  }
  .ai-questionnaire .ai-send-row {
    position: sticky;
    bottom: 0;
    padding: 0.875rem 0;
    background: #f1f5f7;
  }
  @media (max-width: 600px) {
    .ai-content {
      padding: 1rem;
    }
    .ai-composer,
    .ai-greeting {
      padding: 1rem;
    }
  }
</style>
