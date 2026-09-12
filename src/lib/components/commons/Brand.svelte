<script lang="ts">
  let { name = 'ShutterOS', compact = false }: { name?: string; compact?: boolean } = $props();
</script>

<div class="flex items-center gap-3" aria-label={name}>
  <span class="brand-symbol" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><path d="M3 4h26M8 7v21h16V7M8 28h16" /><path
        d="M5 7h8c0 7-3 11-8 14V7ZM27 7h-8c0 7 3 11 8 14V7Z"
        fill="currentColor"
        fill-opacity=".2"
      /><path d="m5 21 3-2v7H5v-5Zm22 0-3-2v7h3v-5Z" /></svg
    >
  </span>
  {#if !compact}<span class="brand-word">{name}<span class="brand-period">.</span></span>{/if}
</div>
