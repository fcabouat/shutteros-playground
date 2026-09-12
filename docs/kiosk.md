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

For the public demo, follow [GitHub Pages publication](publishing.md). The workflow tests both the local build and the repository base path before deploying.

## Portable build

`pnpm build` also runs the portable Vite configuration. It imports `static/kiosk-config.json` while building and packages it in a standalone page. If the JSON names an organisation logo, the prebuild validates the file under `static/` and embeds it separately from the validated JSON. The packaging step adds the content security policy and license notices, then writes the finished page to:

```text
dist/portable/shutteros.html
```

Use this artifact where a single local file is preferable. Because the configuration is embedded, edit `static/kiosk-config.json` and rebuild to change it. The standard build instead reads the deployed JSON at runtime.

## Configuration

`static/kiosk-config.json` uses version 1. It sets the fictional accepted passwords, session and challenge durations, organisation labels, optional local organisation-logo filename, support details, calm-mode default, and the two addresses used only in the sender-spoofing demonstration.

The default configuration has a ten-minute global safety ceiling; the guided ending targets three to five minutes, to validate with a human facilitator. Challenge deadlines are optional and apply only when enabled for a challenge. The visible sticky note contains only the first entry of `acceptedPasswords` (`Bureau2026` by default); the other entries silently accept common weak passwords. Leading/trailing spaces and letter case are tolerated by default. After three unsuccessful attempts, a hint helps the participant continue.

Set `showPasswordHint` to `false` to remove the digital note and use a physical one on the monitor. Write only the chosen fictional password on it. `defaultCalmMode` is true by default, so there are no local challenge timers. Setting it to false enables a 90-second limit after What should I do? in free mode only; the guided ending never adds a timer. Free exploration, a gentle nudge, guided finish of remaining situations, and 45-second mouse/keyboard idle reminders are configurable behaviours; there is no second timer or global deadline reset.

Session duration accepts 1 to 30 minutes; challenge duration accepts 10 to 120 seconds. Address fields are bounded, simple email addresses. The UI shows a clear validation error for malformed, unknown, or out-of-range values and starts no game until valid configuration is available.

Treat the accepted passwords as public game content. They are not credentials and must never be copied from a real account. The simulated login uses an ordinary text input, outside a form, with autocomplete disabled; Enter and the session button both work. Its value is not stored, logged, or sent. There is no HTML password input. This avoids the normal credential-form trigger, but a web page cannot control every browser or password-manager extension: [autocomplete is only a browser hint](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion).

## Ubuntu setup kit

The repository includes `deployment/ubuntu/install.sh`, its support files, verification, and uninstall scripts for a dedicated Ubuntu 24.04 Server. See [the Ubuntu guide](ubuntu-kiosk.md) for prerequisites and recovery. The kit has not been exercised on your physical device and does not claim a universal keyboard or firmware lock.

## Host policy

Run the browser through the organisation's normal Cage/Chromium kiosk configuration. That host policy controls window escape, browser controls, process recovery, operating-system shortcuts, and physical access. ShutterOS offers a deliberate in-game reset shortcut, `Ctrl+Alt+Home`, which returns to its simulated login screen; it cannot lock down the operating system.

Calm mode removes challenge timers for accessibility or facilitation. The configured global session remains in force. The game has no persistent progress, so refreshing the page, closing the browser, or using the in-game logout begins a new session.

## Before opening the kiosk

Use a dedicated browser profile with password saving and autofill disabled through your normal host policy. Put only fictional information in the configuration. Try the entire game on the actual screen, with its mouse or touch input, and verify logout plus one timed reset. The app works without sound; the guide is optional and the language selector is in the taskbar.

For `file:///` use, open `dist/portable/shutteros.html` directly when the optional artifact is required. For normal use, deploy the whole `dist/` directory over local HTTP, then restart the local preview/server after a rebuild so cached file metadata cannot retain an older configuration size. Use the production build for a kiosk; keep `pnpm dev` for development.

The web timer is checked against elapsed time and resynchronises on visibility/focus changes. If the browser process is suspended, the reset takes effect when it can run again. Host-level recovery from a process crash remains the operator’s responsibility.

## Output directories

`dist/index.html` is the deployed site's entry point; copy and serve the whole `dist/` directory. `dist/portable/shutteros.html` is the optional single-file edition. `.svelte-kit/` contains ignored compiler intermediates, including a prerendered index. `src/app.html` and `portable/index.html` are source templates, not duplicated deliveries. There is no generated HTML at the repository root.
