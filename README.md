# cyber-shutteros

**ShutterOS Playground — an independent cybersecurity awareness game for European Cybersecurity Month**

ShutterOS is a French/English cybersecurity-awareness game for a shared kiosk. A fictional desktop presents six short situations: an unknown USB drive, a suspected incident, an urgent email, sender spoofing, a look-alike web login, and an unexpected MFA request.

The guided ending targets three to five minutes and should be validated with a facilitator; the global ten-minute limit is a configurable safety ceiling.

It is a local simulation. It has no backend, account system, persistence, telemetry, CDN, or real authentication. The fictional login phrases, messages, addresses, files, and forms are game content. No input is sent to a service or retained after the current session.

![The fictional desktop and its taskbar](docs/images/desktop.png)

The login begins with a single sticky note. The assistant stays collapsed until requested; the desktop offers free exploration, calm mode by default, all six situations, three quiet routines, and the recap.

## Run and build

Node.js 22.13 or later (Node 24 is used in CI) and pnpm 11.19.0 are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server listens on port 5173. To create both distributable variants:

```sh
pnpm build
```

This creates the prerendered static site in `dist/` and the optional standalone artifact at `dist/portable/shutteros.html`. For kiosk use, serve `dist/` with Python's local HTTP server; `pnpm preview` is for development verification. `pnpm test` runs unit tests, and `pnpm check` runs Svelte diagnostics.

## Configuration and kiosk use

The regular static build loads `kiosk-config.json` at runtime and is the recommended local HTTP path. The portable artifact embeds `static/kiosk-config.json` at build time. Calm mode is optional and removes only challenge deadlines when enabled. `Ctrl+Alt+Home` returns to the simulated login screen.

Read the [player and facilitator guide](docs/user-guide.md) and [kiosk deployment](docs/kiosk.md) before deploying. The host's Cage/Chromium policy, not this page, handles operating-system kiosk lockdown and recovery.

The OS identity and the deploying organisation's name, campaign, and logo are separate. See [organisation branding](docs/branding.md) to personalise a deployment without committing organisation assets.

## Project notes

[Architecture](docs/overview.md) describes the static runtime and boundaries. [Content notes](docs/content.md) covers the educational claims and official references. Contribution and security guidance are in [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

Storybook is available for component development with `pnpm storybook`; its static output is `storybook-static` (`pnpm build:storybook`).

## Validation

```sh
pnpm exec playwright install chromium --only-shell
pnpm verify
pnpm build:storybook
```

`verify` runs the repository's configured lint, formatting, type, test, build, and browser checks. Treat exact checks and counts as repository state, not as a product promise. CI also rebuilds and tests the GitHub Pages path. Publishing is opt-in and requires a successful verification on the default branch; follow the [publication guide](docs/publishing.md).

The [initial publication audit](docs/audit-2026-09-12.md) records the resolved findings, local verification and remaining deployment acceptance checks.

## License

Created by **François Cabouat** ([fcabouat](https://github.com/fcabouat)).

The project source is MIT licensed; see [LICENSE](LICENSE). Redistributed dependencies retain their own licenses; see the [full dependency notices](static/THIRD-PARTY-NOTICES.txt). Each successful build includes `dist/LICENSE` and `dist/THIRD-PARTY-NOTICES.txt`; the portable edition includes the same notices. They are also available from **Start → About ShutterOS**.

This is an independent personal project created for awareness activities during European Cybersecurity Month. It is not affiliated with, endorsed by, or an official product of the campaign, ENISA, the European Commission, or Cybermalveillance.gouv.fr. Names, logos and other third-party identifiers remain the property of their respective rights holders; the MIT license grants no rights to them. No campaign or institutional logo is bundled. See [legal and attribution notes](docs/legal.md).
