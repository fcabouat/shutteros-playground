<script lang="ts">
  let {
    name,
    logo,
    showName = false,
  }: { name: string; logo?: string; showName?: boolean } = $props();
  let failedLogo = $state<string>();
  const hasLogo = $derived(!!logo && failedLogo !== logo);
  const logoOnly = $derived(hasLogo && !showName);
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

<div
  class="organization-brand flex min-w-0 max-w-[340px] items-center gap-3"
  class:logo-only={logoOnly}
  title={name}
>
  {#if hasLogo}<img
      class="organization-logo"
      src={logo}
      alt=""
      onerror={() => (failedLogo = logo)}
    />
  {:else}<span class="organization-placeholder" aria-hidden="true">{initials}</span>{/if}
  <div class="min-w-0" class:sr-only={logoOnly}>
    <p class="truncate text-sm font-medium" title={name}>{name}</p>
  </div>
</div>
