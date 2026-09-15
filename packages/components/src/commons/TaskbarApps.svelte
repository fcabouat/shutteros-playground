<script module lang="ts">
  import type { ChallengeId } from '@shutteros/core/model/game';

  export type TaskbarAppIcon =
    ChallengeId | 'document' | 'folder' | 'help' | 'key' | 'light' | 'monitor' | 'shield';

  export type TaskbarAppEntry = {
    id: string;
    title: string;
    label: string;
    icon: TaskbarAppIcon;
    app?: ChallengeId;
    running: boolean;
    disabled?: boolean;
    onSelect: () => void;
  };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';

  let { entries }: { entries: readonly TaskbarAppEntry[] } = $props();
</script>

{#each entries as entry (entry.id)}
  <button
    class="os-taskbar-app"
    class:taskbar-shortcut={entry.app !== undefined}
    class:active={entry.running}
    disabled={entry.disabled}
    onclick={entry.onSelect}
    aria-label={entry.label}
    title={entry.title}
    data-taskbar-window={entry.id}
  >
    {#if entry.app}<span class="app-icon tiny" data-app={entry.app}
        ><Icon name={entry.icon} size={20} /></span
      >{:else}<Icon name={entry.icon} size={20} />{/if}
  </button>
{/each}
