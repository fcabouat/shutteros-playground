<script lang="ts">
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  let {
    legalNotices,
    legalNoticesFailed,
  }: {
    legalNotices: { projectLicense: string; thirdPartyNotices: string } | null;
    legalNoticesFailed: boolean;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let projectOpen = $state(false);
  let thirdPartyOpen = $state(false);
</script>

<section class="about-screen mx-auto w-full max-w-[760px] p-5 sm:p-8" aria-labelledby="about-title">
  <div class="flex items-start gap-4">
    <span class="app-icon" data-app="shield"><Icon name="shield" size={26} /></span>
    <div class="min-w-0">
      <p class="text-accent text-xs font-semibold uppercase tracking-wide">ShutterOS Playground</p>
      <h1 id="about-title" class="mt-2 text-2xl font-semibold">{copy.about.title}</h1>
      <p class="text-muted mt-2 text-sm leading-relaxed">{copy.about.description}</p>
      <p class="mt-3 text-sm">{copy.about.author}</p>
    </div>
  </div>
  <div class="mt-7 space-y-3">
    <details
      open={projectOpen}
      ontoggle={(event) => (projectOpen = (event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="about-summary"
        >{copy.about.projectLicense}<Icon name="down" size={16} /></summary
      >
      {#if legalNotices}<pre
          class="about-notice">{legalNotices.projectLicense}</pre>{:else if legalNoticesFailed}<p
          class="text-muted p-4 text-sm"
        >
          {copy.about.unavailable}
        </p>{:else}<p class="text-muted p-4 text-sm">{copy.about.loading}</p>{/if}
    </details>
    <details
      open={thirdPartyOpen}
      ontoggle={(event) => (thirdPartyOpen = (event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="about-summary">{copy.about.thirdParty}<Icon name="down" size={16} /></summary>
      {#if legalNotices}<pre
          class="about-notice">{legalNotices.thirdPartyNotices}</pre>{:else if legalNoticesFailed}<p
          class="text-muted p-4 text-sm"
        >
          {copy.about.unavailable}
        </p>{:else}<p class="text-muted p-4 text-sm">{copy.about.loading}</p>{/if}
    </details>
  </div>
  <p class="text-muted mt-6 text-xs leading-relaxed">{copy.about.independence}</p>
</section>

<style>
  .about-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.9rem 1rem;
    font-size: 0.9rem;
    font-weight: 650;
  }
  details {
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }
  .about-notice {
    max-height: 280px;
    overflow: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    padding: 1rem;
    border-top: 1px solid var(--line);
    background: var(--canvas);
    color: var(--ink);
    font: 0.75rem/1.55 var(--font-mono);
  }
</style>
