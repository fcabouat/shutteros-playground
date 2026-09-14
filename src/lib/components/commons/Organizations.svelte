<script lang="ts">
  import { getI18n } from '../i18n/context';
  import OrganizationBrand from './OrganizationBrand.svelte';

  let {
    name,
    logo,
    partnerName,
    partnerLogo,
    campaign,
  }: {
    name?: string;
    logo?: string;
    partnerName?: string;
    partnerLogo?: string;
    campaign?: string;
  } = $props();
  const i18n = getI18n();
</script>

<div class="organization-group" class:joint-organizations={!!partnerName}>
  <OrganizationBrand name={name ?? i18n.text.organizationPlaceholder} {logo} {campaign} />
  {#if partnerName}
    <OrganizationBrand name={partnerName} logo={partnerLogo} />
  {/if}
</div>
