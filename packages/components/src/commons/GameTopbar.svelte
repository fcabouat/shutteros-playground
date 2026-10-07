<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Organizations from './Organizations.svelte';
  import type { Branding } from '../screens/branding';

  let {
    config,
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
    branding = { applicationName: 'ShutterOS' },
    controls,
    inert = false,
  }: {
    config: GameConfig;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
    branding?: Branding;
    controls: Snippet;
    inert?: boolean;
  } = $props();
</script>

<header class="os-topbar" {inert}>
  <div class="desktop-organization">
    <Organizations
      name={branding.organizationName ?? config.organizationName}
      logo={branding.organizationLogo ?? embeddedOrganizationLogo ?? config.organizationLogo}
      partnerName={branding.partnerOrganizationName ?? config.partnerOrganizationName}
      partnerLogo={branding.partnerOrganizationLogo ??
        embeddedPartnerOrganizationLogo ??
        config.partnerOrganizationLogo}
      campaign={branding.campaignName}
      showNames={branding.showOrganizationNames}
    />
  </div>
  {@render controls()}
</header>
