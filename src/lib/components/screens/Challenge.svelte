<script lang="ts">
  import type { GameState, Intent, Scene } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Usb from '../scenarios/Usb.svelte';
  import Incident from '../scenarios/Incident.svelte';
  import Mail from '../scenarios/Mail.svelte';
  import Spoof from '../scenarios/Spoof.svelte';
  import Web from '../scenarios/Web.svelte';
  import Mfa from '../scenarios/Mfa.svelte';

  let {
    snapshot,
    scene,
    config,
    dispatch,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    scene: Extract<Scene, { kind: 'challenge' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
  } = $props();
</script>

<section class="challenge-window" data-challenge={scene.id} data-step={scene.step}>
  {#if scene.id === 'usb'}<Usb {dispatch} />
  {:else if scene.id === 'incident'}<Incident
      step={scene.step === 'notify' ? 'notify' : 'choose'}
      infected={snapshot.usbInfected}
      {config}
    />
  {:else if scene.id === 'mail'}<Mail {snapshot} {dispatch} />
  {:else if scene.id === 'spoof'}<Spoof {config} {dispatch} />
  {:else if scene.id === 'web'}<Web {dispatch} />
  {:else if scene.id === 'mfa'}<Mfa />{/if}
</section>
