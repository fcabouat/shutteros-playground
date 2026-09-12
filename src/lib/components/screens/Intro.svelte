<script lang="ts">
  import { getI18n } from '../i18n/context';
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';
  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
</script>

<section class="intro-card p-6 sm:p-8">
  <div class="reading-column">
    <span class="intro-visual mb-5 inline-flex rounded-xl p-3"><Icon name="key" size={28} /></span>
    <h1 class="text-3xl leading-tight font-semibold tracking-tight">{copy.intro.title}</h1>
    <p class="text-muted mt-4 text-base leading-relaxed">{copy.intro.description}</p>
    <p class="text-muted mt-6 text-sm leading-relaxed">{copy.intro.hint}</p>
    <button class="button button-primary mt-6" onclick={() => dispatch({ type: 'continue' })}
      >{copy.intro.start}<Icon name="arrow" size={18} /></button
    >
  </div>
</section>
