<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { GameConfig } from '@shutteros/core/model/configuration';
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';
  let { config, dispatch }: { config: GameConfig; dispatch: (intent: Intent) => void } = $props();
  let identity = $state('legitimate');
  let name = $state('');
  let sent = $state(false);
  let inspected = $state(false);
  let observedAddress = $state(false);
  const address = $derived(
    identity === 'legitimate' ? config.mailLegitimateAddress : config.mailImpersonatorAddress,
  );
</script>

<div class="p-5 sm:p-7">
  {#if !sent}
    <p class="mb-5 flex items-center gap-2 font-semibold">
      <Icon name="spoof" size={18} />{copy.spoof.compose}
    </p>
    <p class="text-muted mb-5 text-sm leading-relaxed">{copy.spoof.explanation}</p>
    <div class="compose-form rounded-xl border border-[var(--line)]">
      <div class="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <span class="text-muted w-10 shrink-0 text-xs">{copy.spoof.to}</span><span class="text-sm"
          >{copy.spoof.recipient}</span
        >
      </div>
      <div class="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <label for="sender-identity" class="text-muted w-10 shrink-0 text-xs"
          >{copy.spoof.from}</label
        ><select
          id="sender-identity"
          bind:value={identity}
          class="input min-w-0 flex-1 rounded-md px-2 py-2 text-sm"
          ><option value="legitimate"
            >{copy.spoof.legitimate} · {config.mailLegitimateAddress}</option
          ><option value="impostor">{copy.spoof.impostor} · {config.mailImpersonatorAddress}</option
          ></select
        >
      </div>
      <div class="border-b border-[var(--line)] px-4 py-3">
        <label for="sender-name" class="text-muted mb-2 block text-xs"
          >{copy.spoof.displayName}</label
        ><input
          id="sender-name"
          class="input w-full rounded-md px-3 py-2 text-sm"
          bind:value={name}
          placeholder={copy.spoof.initialName}
          maxlength={80}
          autocomplete="off"
        />
      </div>
      <div class="px-4 py-4">
        <p class="mb-4 text-sm font-medium">{copy.spoof.subject}</p>
        <p class="text-muted text-sm leading-relaxed">{copy.spoof.body}</p>
        <button
          class="button button-primary mt-6"
          onclick={() => {
            sent = true;
            inspected = false;
            observedAddress = false;
          }}><Icon name="spoof" size={16} />{copy.spoof.send}</button
        >
      </div>
    </div>
  {:else}
    <div
      class="received-stamp mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
    >
      <Icon name="check" size={14} />{copy.spoof.received}
    </div>
    <article class="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <p class="text-lg font-semibold">{copy.spoof.subject}</p>
      <div class="mt-5 flex items-start gap-3">
        <span class="mail-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          ><Icon name="user" size={22} /></span
        >
        <div class="min-w-0">
          <p class="break-words font-semibold">{name || copy.spoof.initialName}</p>
          <button
            class="text-link mt-1 flex items-center gap-1 text-xs"
            onclick={() => {
              inspected = !inspected;
              observedAddress = true;
            }}
            aria-expanded={inspected}>{copy.spoof.inspect}<Icon name="down" size={14} /></button
          >
        </div>
      </div>
      {#if inspected}<p
          class="mail-details mt-4 break-all rounded-lg p-3 font-mono text-sm"
          data-testid="received-address"
        >
          {address}
        </p>{/if}
      <p class="text-muted mt-5 text-sm leading-relaxed">{copy.spoof.body}</p>
    </article>
    <p class="text-muted mt-4 text-sm leading-relaxed">{copy.spoof.receivedNote}</p>
    <div class="mt-5 flex flex-wrap gap-3">
      <button class="button button-soft" onclick={() => (sent = false)}>{copy.spoof.again}</button
      ><button
        class="button button-primary"
        disabled={!observedAddress}
        onclick={() => {
          if (observedAddress) dispatch({ type: 'choose', choiceId: 'understood' });
        }}>{copy.spoof.understood}<Icon name="check" size={16} /></button
      >
    </div>
  {/if}
  <p class="text-muted mt-5 text-xs leading-relaxed">{copy.spoof.notice}</p>
</div>
