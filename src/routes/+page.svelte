<script lang="ts">
  import { base } from '$app/paths';
  import Application from '$lib/app/Application.svelte';
  import '$lib/components/theme.css';
  import { fr } from '@shutteros/core/data/fr';
</script>

<svelte:head>
  <title>{fr.product} — {fr.tagline}</title>
  <meta name="description" content={fr.login.invitation} />
</svelte:head>

<Application configurationUrl={`${base}/kiosk-config.json`} />
