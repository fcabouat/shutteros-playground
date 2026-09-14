<script lang="ts">
  import type { GameState, Intent, ChallengeId } from '@shutteros/core/model/game';
  import { canExplore, challengeOrder, hasResult } from '@shutteros/core/projections/game';
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
  const helpId = $props.id();
  let selected = $state<ChallengeId | null>(null);

  function activate(id: ChallengeId, event: MouseEvent) {
    selected = id;
    if (event.detail === 0 || event.detail >= 2) {
      dispatch({ type: 'open', id });
    }
  }
</script>

<div class="desktop-canvas relative flex flex-1">
  <span id={helpId} class="sr-only">{copy.desktop.doubleClick}</span>
  <nav
    class="desktop-icons grid auto-rows-min grid-cols-[112px] content-start gap-2"
    aria-label={copy.shell.desktop}
  >
    {#each challengeOrder.filter((id) => id !== 'spoof') as id (id)}
      {@const done = hasResult(snapshot, id) && (id !== 'mail' || hasResult(snapshot, 'spoof'))}
      <button
        class="desktop-icon relative flex flex-col items-center justify-center gap-2 rounded-lg text-center"
        class:selected={selected === id}
        class:running={activeId === id || (id === 'mail' && activeId === 'spoof')}
        disabled={!canExplore(snapshot)}
        onclick={(event) => activate(id, event)}
        aria-describedby={done ? undefined : helpId}
        title={done ? copy.desktop.replay : copy.desktop.doubleClick}
        aria-label={`${copy.desktop[id]}${done ? ` · ${copy.desktop.replay}` : ''}`}
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
