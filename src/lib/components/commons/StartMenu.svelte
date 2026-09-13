<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import { canExplore, challengeOrder, hasResult } from '@shutteros/core/projections/game';
  import { getI18n } from '../i18n/context';
  import Icon from './Icon.svelte';
  import Brand from './Brand.svelte';
  let {
    snapshot,
    config,
    dispatch,
    applicationName = 'ShutterOS',
    onSettings,
    onAbout,
  }: {
    snapshot: Extract<GameState, { phase: 'session' }>;
    config: GameConfig;
    dispatch: (intent: Intent) => void;
    applicationName?: string;
    onSettings: () => void;
    onAbout: () => void;
  } = $props();
  let open = $state(false);
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  function run(intent: Intent) {
    open = false;
    dispatch(intent);
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger class="start-trigger" aria-label={copy.os.start} title={copy.os.start}
    ><Brand name={applicationName} /></Popover.Trigger
  >
  <Popover.Portal>
    <Popover.Content side="top" align="start" sideOffset={12} class="start-menu" lang={i18n.locale}>
      <nav aria-label={copy.os.start}>
        <div class="flex items-center justify-between gap-4 px-6 pt-4">
          <h2 class="text-sm font-semibold">{copy.os.pinned}</h2>
          <span class="text-muted text-xs">{copy.desktop.completed(snapshot.results.length)}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 px-4 py-3">
          {#each challengeOrder as id (id)}
            {@const done = hasResult(snapshot, id)}
            <button
              class="start-app flex flex-col items-center gap-2 rounded-lg p-2 text-center"
              disabled={done || !canExplore(snapshot)}
              onclick={() => run({ type: 'open', id })}
              aria-label={`${copy.os.openApp} ${copy.desktop[id]}`}
            >
              <span class="app-icon small" data-app={id}><Icon name={id} size={22} /></span><span
                class="text-xs leading-snug">{copy.desktop[id]}</span
              >{#if done}<span class="text-muted text-[0.65rem]">{copy.desktop.done}</span>{/if}
            </button>
          {/each}
        </div>
        <div class="border-t border-[var(--line)] px-6 py-3">
          <p class="mb-3 text-xs font-semibold">{copy.os.tools}</p>
          <button
            class="start-tool flex w-full items-center gap-3 rounded-lg p-2 text-left"
            onclick={() => {
              open = false;
              onSettings();
            }}
            ><Icon name="monitor" size={19} /><span class="text-sm">{copy.routines.updates}</span
            ></button
          >
          <button
            class="start-tool flex w-full items-center gap-3 rounded-lg p-2 text-left"
            onclick={() => {
              open = false;
              onAbout();
            }}
          >
            <Icon name="help" size={19} /><span class="text-sm">{copy.about.title}</span>
          </button>
          <button
            class="start-tool flex w-full items-center gap-3 rounded-lg p-2 text-left"
            onclick={() => run({ type: 'practice-lock' })}
            ><Icon name="lock" size={19} /><span class="text-sm">{copy.routines.lockAction}</span
            ></button
          >
          <button
            class="start-tool flex w-full items-center gap-3 rounded-lg p-2 text-left"
            disabled={snapshot.mode === 'guided'}
            onclick={() => run({ type: 'finish-experience' })}
            ><Icon name="secure" size={19} /><span class="text-sm">{copy.shell.finish}</span
            ></button
          >
        </div>
        <div
          class="start-profile flex items-center justify-between gap-4 rounded-b-xl border-t border-[var(--line)] px-6 py-3"
        >
          <span class="flex items-center gap-3 text-sm"
            ><span class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--soft)]"
              ><Icon name="user" size={19} /></span
            >{config.playerName}</span
          ><button
            class="icon-button"
            onclick={() => run({ type: 'logout' })}
            aria-label={copy.shell.logout}
            title={copy.shell.logout}><Icon name="power" size={20} /></button
          >
        </div>
      </nav>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
