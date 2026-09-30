<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    title,
    choices,
    selectedChoiceId,
    context,
    activity,
    class: className = '',
  }: {
    title: string;
    choices: readonly {
      id: string;
      label: string;
      correct: boolean;
      status: string;
      note?: string | null;
      highlight?: { before: string; match: string; after: string } | null;
    }[];
    selectedChoiceId: string;
    context?: { title: string; detail: string };
    activity?: string;
    class?: string;
  } = $props();
  const titleId = $props.id();
</script>

<section class="decision-review {className}" data-activity={activity} aria-labelledby={titleId}>
  <h2 id={titleId} class="decision-review-title">{title}</h2>
  {#if context}
    <p class="decision-review-context">
      <strong>{context.title}</strong>
      <span>{context.detail}</span>
    </p>
  {/if}
  <ul class="decision-review-list">
    {#each choices as choice (choice.id)}
      {@const selected = choice.id === selectedChoiceId}
      <li
        class="decision-review-choice"
        class:selected
        data-choice={choice.id}
        data-outcome={choice.correct ? 'correct' : 'incorrect'}
        aria-current={selected ? 'true' : undefined}
      >
        <span class="decision-review-icon">
          <Icon name={choice.correct ? 'check' : 'close'} size={17} />
        </span>
        <span class="decision-review-label">
          {#if choice.highlight}{choice.highlight.before}<span class="decision-review-security"
              >{choice.highlight.match}</span
            >{choice.highlight.after}{:else}{choice.label}{/if}
          {#if choice.note}<span class="decision-review-tool-note">{choice.note}</span>{/if}
        </span>
        <span class="decision-review-status">{choice.status}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .decision-review {
    margin-top: 1.25rem;
  }
  .decision-review-title {
    margin-bottom: 0.625rem;
    font-size: 0.75rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .decision-review-list {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .decision-review-context {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
    margin: 0 0 0.625rem;
    font-size: 0.8125rem;
  }
  .decision-review-context span {
    color: var(--muted);
  }
  .decision-review-choice {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid transparent;
    border-radius: 0.55rem;
  }
  .decision-review-choice[data-outcome='correct'] {
    border-color: #a8d2b5;
    background: var(--success-soft);
    color: var(--success);
  }
  .decision-review-choice[data-outcome='incorrect'] {
    border-color: #efb5b5;
    background: #fff0f0;
    color: #922e2e;
  }
  .decision-review-choice.selected {
    border-width: 2px;
    border-color: currentColor;
    padding: calc(0.55rem - 1px) calc(0.7rem - 1px);
    box-shadow: 0 0 0 1px #ffffffb8 inset;
  }
  .decision-review-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .decision-review-label {
    min-width: 0;
    color: var(--ink);
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.3;
  }
  .decision-review-tool-note {
    display: block;
    margin-top: 0.3rem;
    font-weight: 400;
    font-size: 0.8125rem;
  }
  .decision-review-security {
    color: #a32924;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.14em;
  }
  .decision-review-status {
    font-size: 0.75rem;
    font-weight: 750;
    line-height: 1.25;
    text-align: right;
  }
  @media (max-width: 520px) {
    .decision-review-choice {
      grid-template-columns: 1.5rem minmax(0, 1fr);
    }
    .decision-review-status {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
