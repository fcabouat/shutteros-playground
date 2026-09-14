<script lang="ts">
  import Provider from '../components/i18n/Provider.svelte';
  import Game from './Game.svelte';
  let {
    configuration,
    configurationUrl,
    embeddedOrganizationLogo,
    embeddedPartnerOrganizationLogo,
  }: {
    configuration?: unknown;
    configurationUrl?: string;
    embeddedOrganizationLogo?: string;
    embeddedPartnerOrganizationLogo?: string;
  } = $props();
</script>

<Provider
  ><Game
    {configuration}
    {configurationUrl}
    {embeddedOrganizationLogo}
    {embeddedPartnerOrganizationLogo}
  /></Provider
>
