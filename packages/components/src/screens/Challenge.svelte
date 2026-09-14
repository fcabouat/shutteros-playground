<script lang="ts">
  import type { GameState, Intent, Scene } from '@shutteros/core/model/game';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import Usb from '../scenarios/Usb.svelte';
  import Incident from '../scenarios/Incident.svelte';
  import Mail from '../scenarios/Mail.svelte';
  import DecisionReview from '../commons/DecisionReview.svelte';
  import Web from '../scenarios/Web.svelte';
  import Mfa from '../scenarios/Mfa.svelte';
  import AiChat from '../scenarios/AiChat.svelte';

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

<div class="challenge-window" data-challenge={scene.id} data-step={scene.step}>
  {#if scene.id === 'usb'}<Usb {dispatch} />
  {:else if scene.id === 'incident'}
    {#if scene.priorChoiceId}<div class="px-6 pt-6">
        <DecisionReview id="incident" selectedChoiceId={scene.priorChoiceId} />
      </div>{/if}
    <Incident
      step={scene.step === 'notify' ? 'notify' : 'choose'}
      infected={snapshot.usbInfected}
      {config}
      {dispatch}
    />
  {:else if scene.id === 'mail' || scene.id === 'spoof'}<Mail {snapshot} {config} {dispatch} />
  {:else if scene.id === 'web'}<Web {dispatch} />
  {:else if scene.id === 'ai'}<AiChat {dispatch} />
  {:else if scene.id === 'mfa'}<Mfa {dispatch} />{/if}
</div>
