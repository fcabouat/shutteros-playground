<script lang="ts">
  let { name, logo, campaign }: { name: string; logo?: string; campaign?: string } = $props();
  let failedLogo = $state<string>();
  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase(),
  );
</script>

<div class="organization-brand flex min-w-0 max-w-[340px] items-center gap-3">
  {#if logo && failedLogo !== logo}<img
      class="organization-logo"
      src={logo}
      alt=""
      onerror={() => (failedLogo = logo)}
    />
  {:else}<span class="organization-placeholder" aria-hidden="true">{initials}</span>{/if}
  <div class="min-w-0">
    <p class="truncate text-sm font-medium" title={name}>{name}</p>
    {#if campaign}<p class="mt-0.5 truncate text-xs text-white/65">{campaign}</p>{/if}
  </div>
</div>
