<script lang="ts">
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';

  let { reread = false, hintTarget = false }: { reread?: boolean; hintTarget?: boolean } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text.ai);
  const policyId = $props.id();
  let open = $state(false);
</script>

<button
  class="ai-policy-toggle"
  data-hint-target={hintTarget ? 'tool' : undefined}
  aria-expanded={open}
  aria-controls={policyId}
  onclick={() => (open = !open)}
>
  <Icon name="document" size={18} />
  <span>{reread ? copy.policyReview : copy.policy}</span>
</button>
{#if open}
  <aside class="ai-policy" id={policyId} aria-label={copy.policy}>
    <p class="font-semibold">{copy.policyIntro}</p>
    <ul class="mt-2 list-disc space-y-2 pl-5">
      {#each copy.policyRules as rule (rule)}<li>{rule}</li>{/each}
    </ul>
  </aside>
{/if}

<style>
  .ai-policy-toggle {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.625rem 0.875rem;
    border: 1px solid #bdd4b2;
    border-radius: 0.5rem;
    background: #edf5e7;
    color: #294c3d;
    font-size: 0.875rem;
    font-weight: 650;
    text-align: left;
    cursor: pointer;
  }
  .ai-policy-toggle:hover,
  .ai-policy-toggle[aria-expanded='true'] {
    background: #e0eed6;
  }
  .ai-policy {
    grid-column: 1 / -1;
    padding: 1rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: 0.5rem;
    background: #f3f7f0;
    color: var(--ink);
    font-size: 0.875rem;
    line-height: 1.6;
  }
</style>
