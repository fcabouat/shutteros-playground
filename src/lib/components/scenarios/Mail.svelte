<script lang="ts">
  import { getI18n } from '../i18n/context';
  const i18n = getI18n();
  const copy = $derived(i18n.text);
  import type { GameState, Intent } from '@shutteros/core/model/game';
  import Icon from '../commons/Icon.svelte';
  import LearningPanel from '../commons/LearningPanel.svelte';
  let {
    snapshot,
    dispatch,
  }: { snapshot: Extract<GameState, { phase: 'session' }>; dispatch: (intent: Intent) => void } =
    $props();
  let details = $state(false);
  let account = $state(false);
</script>

{#if snapshot.mode === 'free'}<div
    class="mail-account-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3"
  >
    <span class="text-muted text-xs"
      >{snapshot.routines.password === 'done'
        ? copy.routines.passwordDone
        : copy.routines.password}</span
    >
    <button class="text-link text-sm" onclick={() => (account = !account)}
      >{account ? copy.experience.back : copy.routines.account}</button
    >
  </div>{/if}
{#if account && snapshot.mode === 'free'}
  <section class="account-view p-5 sm:p-6">
    <div class="reading-column">
      <h2 class="text-xl font-semibold">{copy.routines.password}</h2>
      <p class="text-muted mt-3 text-sm leading-relaxed">
        {copy.routines.passwordBody}
      </p>
      {#if snapshot.routines.password === 'done'}
        <LearningPanel
          lesson={copy.routines.passwordLesson}
          points={copy.education.password}
          {snapshot}
          {dispatch}
        />
      {:else}
        <div class="mt-5 flex flex-wrap gap-3">
          <button
            class="button button-primary"
            onclick={() => dispatch({ type: 'routine', id: 'password', action: 'complete' })}
            >{copy.routines.passwordAction}</button
          ><button
            class="button button-text"
            onclick={() => {
              dispatch({ type: 'routine', id: 'password', action: 'later' });
              account = false;
            }}>{copy.routines.later}</button
          >
        </div>
      {/if}
    </div>
  </section>
{:else}
  <div class="mail-scene grid sm:grid-cols-[165px_1fr]">
    <aside class="mail-list hidden border-r border-[var(--line)] sm:block">
      <div class="px-4 py-4">
        <p class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="mail" size={17} />{copy.mail.inbox}
        </p>
        <p class="text-muted mt-2 text-xs">{copy.mail.unread}</p>
      </div>
      <div class="mail-list-active border-y border-[var(--line)] px-4 py-4">
        <p class="text-xs font-semibold">{copy.mail.sender}</p>
        <p class="mt-2 text-xs leading-relaxed">{copy.mail.subject}</p>
        <p class="text-muted mt-2 text-xs">{copy.mail.date}</p>
      </div>
      <div class="text-muted px-4 py-4">
        <p class="text-xs font-medium">{copy.mail.neutralSender}</p>
        <p class="mt-2 text-xs leading-relaxed">{copy.mail.neutralSubject}</p>
      </div>
    </aside>
    <article class="min-w-0 px-5 py-6 sm:px-6">
      <h2 class="text-xl leading-snug font-semibold tracking-tight">{copy.mail.subject}</h2>
      <div class="mt-5 flex items-start gap-3">
        <span class="mail-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          ><Icon name="user" size={18} /></span
        >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">{copy.mail.sender}</p>
          <p class="text-muted mt-1 text-xs">{copy.mail.to}</p>
          <button
            class="text-link mt-2 flex items-center gap-1 text-xs"
            onclick={() => (details = !details)}
            aria-expanded={details}>{copy.mail.details}<Icon name="down" size={13} /></button
          >
        </div>
      </div>
      {#if details}<div class="mail-details mt-4 rounded-lg p-3">
          <p class="text-xs font-semibold">{copy.mail.actualAddress}</p>
          <p class="mt-1 break-all font-mono text-sm">{copy.mail.address}</p>
          <p class="text-muted mt-3 text-xs leading-relaxed">{copy.mail.noSignature}</p>
        </div>{/if}
      <div class="mt-7 space-y-4 text-sm leading-[1.8]">
        <p>{copy.mail.bodyStart}</p>
        <p>{copy.mail.body}</p>
        <button
          class="fake-mail-link text-left underline underline-offset-4"
          onclick={() => dispatch({ type: 'choose', choiceId: 'open' })}
          >{copy.mail.link}<Icon name="external" size={14} class="ml-1 inline" /></button
        >
        <p>{copy.mail.bodyEnd}<br />{copy.mail.signature}</p>
      </div>
    </article>
  </div>
{/if}
