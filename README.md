# ShutterOS Playground

[![CI](https://github.com/fcabouat/shutteros-playground/actions/workflows/ci.yml/badge.svg)](https://github.com/fcabouat/shutteros-playground/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A familiar desktop. A safe place to make mistakes.**

ShutterOS is a French/English cybersecurity awareness game for the browser or a shared kiosk. In five to fifteen minutes, players explore a
fictional desktop and practise seven situations involving a found USB drive, an
incident, urgent mail, sender spoofing, a look-alike login, an unexpected sign-in
request, and sharing work information with an AI assistant.

[**Play the live demo**](https://fcabouat.github.io/shutteros-playground/demo/?lang=en) · [Jouer en français](https://fcabouat.github.io/shutteros-playground/demo/?lang=fr)

Use it in a reception area, a team workshop or a Cybersecurity Month event. Add your organisation’s identity, configure the session length, and let the kiosk reset for the next player. Players can explore freely or choose a guided finish.
The experience is local and fictional: it has no backend, account system,
telemetry, persistence, external API, or real authentication. Game phrases,
messages, addresses, files, and forms stay in the current session and are never
sent to a service. A hosted deployment still receives ordinary requests for its static files.

![The fictional ShutterOS desktop](docs/images/desktop.png)

## Explore

- [Project site](https://fcabouat.github.io/shutteros-playground/) — landing
  page, guides, downloads, API, Storybook, and demo links.
- [Player and facilitator guide (English)](https://fcabouat.github.io/shutteros-playground/guide/en.html)
  · [Guide (français)](https://fcabouat.github.io/shutteros-playground/guide/fr.html)
- [Core API](https://fcabouat.github.io/shutteros-playground/api/) ·
  [Storybook](https://fcabouat.github.io/shutteros-playground/storybook/)
- [Standalone demo](https://fcabouat.github.io/shutteros-playground/demo/portable/shutteros.html)
  — one self-contained HTML file for offline use.

## Run locally

Use Node.js 22.13 or later and pnpm 11.19:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Build the ordinary kiosk delivery and optional portable file with:

```sh
pnpm build
```

This writes `dist/` and `dist/portable/shutteros.html`. Serve `dist/` over local HTTP
for a kiosk; `pnpm preview` is for development verification. Configure the
organisation name, branding, and local security contact as described in the
[kiosk guide](docs/kiosk.md) and [branding guide](docs/branding.md).

Bun can run the existing scripts after the locked pnpm installation (`bun run dev`, `bun run build`, and `bun run check`).

## Build the public site

The site build assembles the landing page, demo, bilingual guides, generated API
reference, and Storybook under `dist/site/`:

```sh
pnpm build:site
pnpm test:site
```

The site build includes TypeDoc; `pnpm docs:api` regenerates only its reference in `.site-build/api`. Run `pnpm build` again before distributing the root-path kiosk edition.

## Architecture

A pure TypeScript core owns the decisions and session progression. Svelte views render state; browser adapters supply effects. Package boundaries, import rules and tests enforce that separation. See the [architecture overview](docs/overview.md).

## Validation

```sh
pnpm verify
```

The command covers linting, formatting, types, unused-code checks, unit tests, the kiosk build, and browser checks. Install Playwright Chromium with `pnpm exec playwright install chromium --only-shell`. See the
[verification guide](docs/verification.md), [CONTRIBUTING.md](CONTRIBUTING.md),
and [publishing guide](docs/publishing.md).

## License and attribution

The source is licensed under the MIT license; see [LICENSE](LICENSE).
Redistributed dependencies retain their own licenses; see
[dependency notices](static/THIRD-PARTY-NOTICES.txt) and the in-app About screen.

ShutterOS is an independent personal project for awareness activities during
European Cybersecurity Month. It is not affiliated with, endorsed by, or an
official product of the campaign, ENISA, the European Commission, or
Cybermalveillance.gouv.fr. Third-party names and logos belong to their rights
holders, and the MIT license grants no rights to them. See the
[legal and attribution notes](docs/legal.md).
