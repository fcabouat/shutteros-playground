<script lang="ts">
  import type { GameState, Intent, ChallengeId } from '@shutteros/core/model/game';
  import { canExplore, challengeOrder } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  import Icon from '../commons/Icon.svelte';
  import Brand from '../commons/Brand.svelte';

  let {
    snapshot,
    dispatch,
    activeId = null,
    applicationName = 'ShutterOS',
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    dispatch: (intent: Intent) => void;
    activeId?: ChallengeId | null;
    applicationName?: string;
  } = $props();
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  let selected = $state<ChallengeId | null>(null);

  function activate(id: ChallengeId, event: MouseEvent) {
    selected = id;
    if (event.detail === 0 || event.detail >= 2) {
      dispatch({ type: 'open', id });
    }
  }
</script>

<div class="desktop-canvas relative flex flex-1">
  <h1 class="sr-only">{copy.shell.desktop}</h1>
  <nav
    class="desktop-icons grid auto-rows-min grid-cols-[112px] content-start gap-2"
    aria-label={copy.shell.desktop}
  >
    {#each challengeOrder as id (id)}
      {@const done = snapshot.results.some((result) => result.id === id)}
      <button
        class="desktop-icon relative flex flex-col items-center justify-center gap-2 rounded-lg text-center"
        class:selected={selected === id}
        class:running={activeId === id}
        disabled={done || !canExplore(snapshot)}
        onclick={(event) => activate(id, event)}
        title={done ? copy.desktop.done : copy.desktop.doubleClick}
        aria-label={`${copy.desktop[id]}${done ? ` · ${copy.desktop.done}` : ''}`}
      >
        <span class="app-icon relative" data-app={id}
          ><Icon name={id} size={27} />{#if done}<span class="done-badge"
              ><Icon name="check" size={10} /></span
            >{/if}</span
        >
        <span class="desktop-icon-label text-xs leading-snug font-medium">{copy.desktop[id]}</span>
      </button>
    {/each}
  </nav>
  <div class="desktop-watermark pointer-events-none absolute text-center" aria-hidden="true">
    <Brand name={applicationName} />
  </div>
</div>
