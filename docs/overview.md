# Architecture overview

ShutterOS is a short, local cybersecurity-awareness game for an unattended kiosk. The guided ending targets three to five minutes, to validate with a facilitator; the global ten-minute limit is a safety ceiling. It has no backend, account, persistence, telemetry, CDN dependency, or real authentication.

The participant moves through a simulated desktop and six situations:

1. **Login** — enter one of the kiosk's configured fictional access phrases.
2. **Unknown USB drive** — do not open it on the workstation; use the organisation's process or a dedicated inspection station.
3. **Suspected incident** — isolate the workstation from the network, then notify the usual support channel.
4. **Urgent email** — verify an unusual request through a known second channel.
5. **Sender spoofing demonstration** — locally change the displayed sender and inspect the received preview.
6. **Look-alike web login** — reach the service through a known address or bookmark; HTTPS alone does not establish that a site is legitimate.
7. **Unexpected MFA prompt** — deny and report a sign-in the participant did not initiate.

The desktop also reinforces three quiet routines: keep work and personal passwords separate and use a password manager; install company-approved system and software updates; lock the screen when stepping away.

The content follows a small set of durable habits: keep work and personal secrets separate; use long, unique passwords and change them promptly after compromise or suspicion; follow company password renewal and system/software update policies; never share an OTP or approve an unexpected MFA prompt; isolate and report suspected incidents quickly. Reporting is framed as a protective action and never as a reason for blame.

All names, messages, addresses, passwords, files, and portals are fictional. Inputs stay in browser memory for the current game. The scenarios do not send mail, access a network service, open an operating-system application, or inspect a real USB device.

## Runtime boundaries

`packages/core` is a dependency-free, framework-free state machine package. It receives a numeric clock value and configuration, reduces local intents into a new state, and owns the session and challenge deadlines. Time is absolute rather than decremental, so a suspended tab does not gain time. Logging out or a global timeout discards the session. Extracting it makes the game rules independently type-checkable and prevents browser or Svelte dependencies from entering them.

`src/lib/contract` validates the versioned kiosk JSON format without importing the game. `src/lib/infrastructure` turns a valid contract into the runtime configuration and, for the standard build, loads it at runtime. `src/lib/components` render the fictional interface and emit intents; they do not decide outcomes. `src/lib/app` composes those layers. No global store or event log is needed for this bounded game.

The standard SvelteKit build is prerendered static output in `dist/`. It obtains `kiosk-config.json` through HTTP at startup and loads the local third-party license text for About independently of the game startup. An optional organisation logo is another local image resource. The portable Vite build imports the same JSON at build time and produces an optional self-contained file at `dist/portable/shutteros.html`.

## Timing and accessibility

The participant can explore freely for the whole global session and choose a situation whenever they want. A gentle nudge may appear after 25 seconds in a challenge, without automatically switching the situation. Calm mode is enabled by default and has no local countdown. An operator can set defaultCalmMode to false: a 90-second challenge timer then starts only after the participant selects What should I do?. Guided mode always uses only the global timer. A guided finish opens only remaining situations and does not start a second timer or reset the global deadline. After 45 seconds without mouse or keyboard input, a configurable, non-intrusive reminder may appear. The operator can return to the simulated login screen with `Ctrl+Alt+Home`.

The complete encounter allows ten minutes by default; its guided ending targets no more than five minutes of interaction. Both the target and pacing should be validated with people. Optional two-choice microchecks have their own view, opened on demand; they are skippable, do not affect the primary score, and should never become mandatory gates. Wider draggable windows leave the desktop visible and keep placement only for the current session.

The application supports keyboard and pointer use, provides visible focus handling and a skip link, and avoids making sound necessary. System lockdown is outside the web application: deployers handle it with their established Cage/Chromium kiosk policy. A web page is not an operating-system sandbox and cannot protect the host from physical access or restore a browser process after a crash.

## Delivery and maintenance

The project is intentionally static. `pnpm build` produces the regular static site and the optional portable artifact. For a kiosk, serve `dist/` with Python's local HTTP server; `pnpm preview` is for local development verification and `pnpm dev` is for development. The [GitHub Pages workflow](publishing.md) tests and deploys the repository base path. Storybook is a development aid.

The configuration is validated before a session starts. Invalid input produces diagnostics instead of silently falling back to defaults. No service worker is used, so a kiosk refresh does not preserve a stale game session or configuration cache.

## Native surfaces and game actions

Applications show their own interface: USB file list, mail, browser tabs/address bar, and a standalone MFA phone. Questions and hints live in a separate desktop action widget. In free mode it starts collapsed behind **What should I do?**; opening it starts the optional local timer, when configured. Guided mode opens it immediately for remaining situations. At wide kiosk sizes the application leaves space for the widget; on narrower screens the widget overlays it and can be collapsed. Detailed lessons and optional microchecks each have their own view rather than stacked disclosures.

The lower-left Start button combines the OS icon and name. Its menu opens applications, the update centre, session locking, and the guided finish. Organisation identity occupies the upper-left corner; the OS watermark stays centred on the wallpaper. Hints are at the upper right and disappear on the recap; ambient notifications appear at the lower right. Voluntary logout from the taskbar, Start menu or recap requires confirmation. Cancelling leaves the current view and draft intact. The operator reset shortcut and global expiry remain immediate.
