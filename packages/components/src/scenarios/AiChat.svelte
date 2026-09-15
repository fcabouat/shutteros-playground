<script lang="ts">
  import type { AiPrompt, AiTool, Intent } from '@shutteros/core/model/game';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';

  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text.ai);
  // Interleave the drafts so position does not group them by outcome or redaction.
  const promptOptions = [
    'confidentialAnonymised',
    'routine',
    'generic',
    'confidential',
    'routineAnonymised',
  ] as const satisfies readonly AiPrompt[];
  // These are fictional draft selections, discarded with the mounted session.
  // The core evaluates the submitted pair; this view never awards an outcome.
  let tool = $state<AiTool>('internal');
  let connected = $state(false);
  let prompt = $state<AiPrompt | null>(null);
  let policyOpen = $state(false);
  const policyId = $props.id();
  const preview = $derived(prompt === null ? '' : copy[`${prompt}Prompt`]);
</script>

<section class="ai-chat" aria-label={copy.app}>
  <header class="ai-toolbar">
    <span class="ai-brand"><Icon name="ai" size={19} />{connected ? copy[tool] : copy.app}</span>
    <button
      class="text-link"
      data-hint-target="tool"
      aria-expanded={policyOpen}
      aria-controls={policyId}
      onclick={() => (policyOpen = !policyOpen)}
      ><Icon name="document" size={15} />{copy.policy}</button
    >
  </header>
  {#if policyOpen}
    <aside class="ai-policy" id={policyId}>
      <p class="font-semibold">{copy.policyIntro}</p>
      <ul class="mt-2 list-disc space-y-2 pl-5">
        {#each copy.policyRules as rule (rule)}<li>{rule}</li>{/each}
      </ul>
    </aside>
  {/if}
  {#if !connected}
    <div class="ai-connect">
      <span class="app-icon" data-app="ai"><Icon name="ai" size={26} /></span>
      <h2 class="mt-4 text-xl font-semibold">{copy.intro}</h2>
      <p class="text-muted mt-2 text-sm leading-relaxed">{copy.task}</p>
      <fieldset class="mt-6" data-hint-target="tool">
        <legend class="mb-3 text-sm font-semibold">{copy.tools}</legend>
        <div class="ai-tools">
          {#each ['internal', 'commercial'] as value (value)}
            {@const id = value as AiTool}
            <label class="ai-tool" class:chosen={tool === id}>
              <input type="radio" name="ai-tool" value={id} bind:group={tool} />
              <span
                ><strong>{copy[id]}</strong><span class="text-muted mt-1 block text-xs"
                  >{copy[`${id}Note`]}</span
                ></span
              >
            </label>
          {/each}
        </div>
      </fieldset>
      <button class="button button-primary mt-5" onclick={() => (connected = true)}
        >{copy.connect}<Icon name="arrow" size={17} /></button
      >
    </div>
  {:else}
    <div class="ai-conversation">
      <div class="ai-workspace">
        <span class="text-muted text-xs">{copy[`${tool}Note`]}</span>
        <button
          data-hint-target="tool"
          class="text-link text-xs"
          onclick={() => (connected = false)}>{copy.switch}</button
        >
      </div>
      <div class="ai-greeting">
        <Icon name="ai" size={22} />
        <p>{copy.welcome}</p>
      </div>
      <fieldset>
        <legend class="mb-3 text-sm font-semibold">{copy.choosePrompt}</legend>
        <div class="ai-prompts">
          {#each promptOptions as id (id)}
            <label class="ai-prompt" class:chosen={prompt === id}>
              <input type="radio" name="ai-prompt" value={id} bind:group={prompt} />{copy[id]}
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="ai-composer">
        <p class="text-muted mb-2 text-xs font-semibold">{copy.preview}</p>
        <p class="ai-preview" aria-live="polite">{preview || copy.empty}</p>
        <div class="mt-4 flex justify-end">
          <button
            class="button button-primary"
            disabled={prompt === null}
            onclick={() => {
              if (prompt !== null) dispatch({ type: 'send-ai', tool, prompt });
            }}>{copy.send}<Icon name="spoof" size={17} /></button
          >
        </div>
      </div>
    </div>
  {/if}
  <footer class="ai-footer">{copy.fiction}</footer>
</section>

<style>
  .ai-chat {
    background: #f8fafb;
    color: var(--ink);
    min-height: 440px;
  }
  .ai-toolbar,
  .ai-brand,
  .ai-workspace {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .ai-toolbar {
    justify-content: space-between;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
    padding: 1rem 1.25rem;
    background: white;
  }
  .ai-brand {
    font-size: 0.875rem;
    font-weight: 650;
  }
  .ai-toolbar button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .ai-connect,
  .ai-conversation {
    max-width: 800px;
    margin: auto;
    padding: 1.5rem;
  }
  .ai-connect {
    max-width: 640px;
  }
  .ai-policy {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--line);
    background: #eaf1f5;
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  .ai-tools,
  .ai-prompts {
    display: grid;
    gap: 0.625rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ai-tool,
  .ai-prompt {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid #9bafb9;
    border-radius: 0.5rem;
    padding: 0.8rem;
    background: white;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .ai-tool.chosen,
  .ai-prompt.chosen {
    background: #e4f0f4;
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  input {
    accent-color: var(--accent);
    flex: none;
  }
  .ai-workspace {
    justify-content: space-between;
  }
  .ai-greeting {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1.5rem 0;
    font-size: 0.9375rem;
  }
  .ai-composer {
    margin-top: 1rem;
    padding: 1.1rem;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    background: white;
    box-shadow: 0 2px 10px #17233008;
  }
  .ai-preview {
    min-height: 4.5rem;
    font-size: 0.875rem;
    line-height: 1.7;
  }
  .ai-footer {
    padding: 0.5rem 1rem 1rem;
    text-align: center;
    font-size: 0.6875rem;
    color: var(--muted);
  }
  @media (max-width: 600px) {
    .ai-tools,
    .ai-prompts {
      grid-template-columns: 1fr;
    }
    .ai-connect,
    .ai-conversation {
      padding: 1rem;
    }
  }
</style>
