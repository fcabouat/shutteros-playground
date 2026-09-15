<script lang="ts">
  let { text, emphasis }: { text: string; emphasis: string } = $props();
  // The translated excerpt is editorial data; never interpret lesson text as HTML.
  const start = $derived(emphasis ? text.indexOf(emphasis) : -1);
</script>

{#if start < 0}{text}{:else}{text.slice(0, start)}<mark class="learning-highlight">{emphasis}</mark
  >{text.slice(start + emphasis.length)}{/if}
