# Kiosk deployment

ShutterOS is a static browser application. Build with `pnpm build`, then serve `dist/` over local HTTP with Python; `pnpm preview` is for development verification and `pnpm dev` is for development. A portable HTML artifact is optional. It does not require an application server, database, identity provider, external API, CDN, or Internet connection after its files are available.

## Standard static build

Install the locked dependencies with Node.js 22.13 or later (Node 24 is used in CI) and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The regular SvelteKit output is written to `dist/`. For the kiosk, serve it with Python's static server (replace the path with the absolute build path):

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory /path/to/dist
```

At startup, the application requests `kiosk-config.json` from the deployed base path. Keep that JSON beside the generated site and serve it as JSON. If it names an optional `organizationLogo`, keep that PNG, WebP, or SVG file beside the JSON and site entry point as well. The value is a local filename such as `logo-organisation.svg`, never a path or URL.

After building the public product site with `pnpm build:site`, run `pnpm build` again before distributing a root-path kiosk build. For the public demo, follow [GitHub Pages publication](publishing.md). The workflow tests both the local build and the repository base path before deploying.

## Portable build

`pnpm build` also runs the portable Vite configuration. It imports `static/kiosk-config.json` while building and packages it in a standalone page. If the JSON names an organisation logo, the prebuild validates the file under `static/` and embeds it separately from the validated JSON. The packaging step adds the content security policy and license notices, then writes the finished page to:

```text
dist/portable/shutteros.html
```

Use this artifact where a single local file is preferable. Because the configuration is embedded, edit `static/kiosk-config.json` and rebuild to change it. The standard build instead reads the deployed JSON at runtime.

## Configuration

`static/kiosk-config.json` uses version 1. It sets the fictional accepted passwords, global session duration, organisation labels, optional local organisation-logo filename, security contact details, and fictional mail addresses used in the simulation. `mailLegitimateAddress` is the familiar sender of the unusual request; `mailImpersonatorAddress` is the suspicious sender of the ordinary request. The global session duration defaults to thirty minutes.

`supportLabel` and `supportContact` identify the organisation’s security reporting channel. Configure that direct contact; the general help desk can be a fallback if your procedure requires it. Routine workstation maintenance remains an IT responsibility.

The guided ending targets three to five minutes, to validate with a human facilitator. The visible sticky note uses the first entry of `acceptedPasswords`. The built-in phrase adapts to French (`Bureau2026`) or English (`Office2026`), provided that translation is also in the accepted list. A custom first phrase stays unchanged. Other entries silently accept common weak passwords. Leading/trailing spaces and letter case are tolerated by default. After three unsuccessful attempts, a hint helps the participant continue.

On page load, `?lang=fr` or `?lang=en` selects the game language when present. Otherwise, the first supported French or English browser language is selected, with French as the fallback. The FR/EN selector remains available; its choice survives next-player resets until the page reloads. No language preference is stored.

Set `showPasswordHint` to `false` to remove the digital note and use a physical one on the monitor. Write only the chosen fictional password on it. Free exploration, nudges, guided finish, and idle reminders (45 seconds by default) are configurable within the global session.

Session duration accepts 1 to 30 minutes. Address fields are bounded, simple email addresses. The UI shows a clear validation error for malformed, unknown, or out-of-range values and starts no game until valid configuration is available. Older V1 files may still include `challengeSeconds`, `explorationSeconds` and `defaultCalmMode`; these keys remain accepted and validated for compatibility but are unused.

Treat the accepted passwords as public game content. They are not credentials and must never be copied from a real account. The simulated login uses an ordinary text input, outside a form, with autocomplete disabled; Enter and the session button both work. Its value is not stored, logged, or sent. There is no HTML password input. This avoids the normal credential-form trigger, but a web page cannot control every browser or password-manager extension: [autocomplete is only a browser hint](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion).

## Ubuntu setup kit

The repository includes `deployment/ubuntu/install.sh`, its support files, verification, and uninstall scripts for a dedicated Ubuntu 24.04 Server. See [the Ubuntu guide](ubuntu-kiosk.md) for prerequisites, validation status, hardware acceptance checks, and recovery.

## Host policy

Run the browser through the organisation's normal Cage/Chromium kiosk configuration. That host policy controls window escape, browser controls, process recovery, operating-system shortcuts, and physical access. ShutterOS offers a deliberate in-game reset shortcut, `Ctrl+Alt+Home`, which returns to its simulated login screen; it cannot lock down the operating system.

The Ubuntu launcher opts into a browser keyboard guard with `?kiosk=1`; the public
demo does not request fullscreen or capture keys. Login requests JavaScript
fullscreen and Keyboard Lock when supported. Captured browser shortcuts are
filtered while typing, keyboard navigation and the operator reset remain usable.
In kiosk mode, context menus, auxiliary clicks and Ctrl + wheel browser zoom are
also suppressed; ordinary scrolling and touch remain available.
This is a convenience guard, not OS confinement: capture can fail, a long Escape
can release it, and the host still owns crash recovery. The game does not retry
fullscreen without another login gesture.

The game has no persistent progress, so refreshing the page, closing the browser, or using the in-game logout begins a new session.

## Before opening the kiosk

Use a dedicated browser profile with password saving and autofill disabled through your normal host policy. Keep game passwords and scenario identities fictional; use the organisation's real branding and security reporting contact. Try the entire game on the actual screen, with its mouse or touch input, and verify logout plus one timed reset. The app works without sound; the guide is optional and the language selector is in the taskbar.

For `file:///` use, open `dist/portable/shutteros.html` directly when the optional artifact is required. For normal use, deploy the whole `dist/` directory over local HTTP. Use the production build for a kiosk; keep `pnpm dev` for development.

After updating files or configuration, reload the page or restart Chromium. An open tab keeps its loaded code and configuration; leaving the game session does not reload them. There is no service worker, but browser or hosting caches can still affect delivery: verify the deployed version after reloading. The Ubuntu installer restarts the kiosk browser during an update. For development verification, restart `pnpm preview` after rebuilding.

The session clock is checked against elapsed time and resynchronises on visibility/focus changes. If the browser process is suspended, the reset takes effect when it can run again. Host-level recovery from a process crash remains the operator’s responsibility.

## Output directories

| Path                                  | Purpose                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dist/`                               | Static site, runtime configuration and license notices; copy and serve the whole directory. |
| `dist/portable/shutteros.html`        | Self-contained single-file edition.                                                         |
| `.svelte-kit/`                        | Ignored compiler intermediates.                                                             |
| `src/app.html`, `portable/index.html` | Source templates for the two builds.                                                        |
