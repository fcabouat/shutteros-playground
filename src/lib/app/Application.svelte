<script lang="ts">
  import Provider from '../components/i18n/Provider.svelte';
  import Game from './Game.svelte';
  let {
    configuration,
    configurationUrl,
    embeddedOrganizationLogo,
  }: {
    configuration?: unknown;
    configurationUrl?: string;
    embeddedOrganizationLogo?: string;
  } = $props();
</script>

<Provider><Game {configuration} {configurationUrl} {embeddedOrganizationLogo} /></Provider>
