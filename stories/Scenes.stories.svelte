<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ScreenPreview from './ScreenPreview.svelte';
  import {
    config,
    login,
    intro,
    desktop,
    challenge,
    infection,
    debrief,
    locked,
    lowTime,
    routines,
  } from './scenarios';

  const { Story } = defineMeta({
    title: 'Game/Scenes',
    component: ScreenPreview,
    args: { config },
  });
</script>

<Story name="Login" args={{ initial: login }} />
<Story name="First insight" args={{ initial: intro }} />
<Story name="Desktop" args={{ initial: desktop }} />
<Story name="USB drive" args={{ initial: challenge('usb') }} />
<Story name="Incident" args={{ initial: challenge('incident') }} />
<Story name="Suspicious email" args={{ initial: challenge('mail') }} />
<Story name="Sender studio" args={{ initial: challenge('spoof') }} />
<Story name="Fake portal" args={{ initial: challenge('web') }} />
<Story name="Unexpected MFA" args={{ initial: challenge('mfa') }} />
<Story name="Infection feedback" args={{ initial: infection }} />
<Story name="Personal recap" args={{ initial: debrief }} />
<Story name="English desktop" args={{ initial: desktop, locale: 'en' }} />

<Story name="Guided routines" args={{ initial: routines }} />
<Story name="Session locked" args={{ initial: locked }} />
<Story name="Session ending soon" args={{ initial: lowTime }} />
<Story name="English MFA" args={{ initial: challenge('mfa'), locale: 'en' }} />

<Story name="AI assistant" args={{ initial: challenge('ai') }} />
<Story name="English AI assistant" args={{ initial: challenge('ai'), locale: 'en' }} />
