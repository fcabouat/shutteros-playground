<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';
  let { dispatch }: { dispatch: (intent: Intent) => void } = $props();
</script>

<div class="web-scene flex h-full flex-col">
  <div class="browser-chrome">
    <div class="browser-tabs flex items-center gap-2 px-3 pt-2">
      <div class="browser-tab flex max-w-[300px] items-center gap-2 rounded-t-lg px-3 py-2 text-xs">
        <Icon name="web" size={14} /><span class="truncate">{copy.web.tab}</span><Icon
          name="close"
          size={12}
        />
      </div>
    </div>
    <div class="browser-toolbar flex items-center gap-3 border-b border-[var(--line)] px-3 py-2">
      <div class="browser-navigation flex items-center gap-3" aria-hidden="true">
        <Icon name="back" size={16} /><Icon name="next" size={16} /><Icon name="reload" size={15} />
      </div>
      <div
        class="address-bar flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
        title={copy.web.transport}
      >
        <Icon name="lock" size={14} /><input
          class="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
          aria-label={copy.web.addressBar}
          value={copy.web.url}
          readonly
          spellcheck="false"
        />
      </div>
    </div>
  </div>
  <div class="fake-portal portal-layout">
    <div class="portal-card w-full rounded-xl p-5">
      <h2 class="text-xl font-semibold tracking-tight">{copy.web.heading}</h2>
      <p class="text-muted mt-3 text-sm leading-relaxed">{copy.web.body}</p>
      <div class="mt-5">
        <p class="text-muted mb-2 text-xs">{copy.web.username}</p>
        <div class="fake-input rounded-md px-3 py-2.5 text-xs">{copy.web.fakeUser}</div>
        <p class="text-muted mt-3 mb-2 text-xs">{copy.web.password}</p>
        <div class="fake-input rounded-md px-3 py-2.5 text-sm">{copy.web.fakeSecret}</div>
      </div>
      <button
        class="portal-submit mt-5 w-full rounded-lg py-3 text-sm font-semibold"
        onclick={() => dispatch({ type: 'choose', choiceId: 'submit' })}>{copy.web.submit}</button
      >
      <p class="text-muted mt-3 text-center text-xs leading-relaxed">{copy.web.fiction}</p>
    </div>
  </div>
</div>
