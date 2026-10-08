<script lang="ts">
  import { getI18n } from '../i18n/context';
  import OrganizationBrand from './OrganizationBrand.svelte';

  let {
    name,
    logo,
    partnerName,
    partnerLogo,
    campaign,
    showNames = false,
  }: {
    name?: string;
    logo?: string;
    partnerName?: string;
    partnerLogo?: string;
    campaign?: string;
    showNames?: boolean;
  } = $props();
  const i18n = getI18n();
</script>

<div class="organization-identity">
  <div class="organization-group" class:joint-organizations={!!partnerName}>
    <OrganizationBrand
      name={name ?? i18n.text.organizationPlaceholder}
      {logo}
      showName={showNames}
    />
    {#if partnerName}
      <OrganizationBrand name={partnerName} logo={partnerLogo} showName={showNames} />
    {/if}
  </div>
  {#if campaign}<p class="organization-campaign" title={campaign}>{campaign}</p>{/if}
</div>
