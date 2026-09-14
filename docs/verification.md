# Verification and release checks

Run verification from a clean checkout with the committed lockfile. Keep organisation configuration and assets separate from the public build.

## Local checks

Use Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm verify
pnpm audit --audit-level high
```

On Linux hosts without the browser's system libraries, use `pnpm exec playwright install --with-deps chromium --only-shell`. This installs system packages and may require administrator privileges.

`verify` stops at the first failed step. It runs lint, formatting, core TypeScript and Svelte diagnostics, Knip, unit tests, both production builds, and Chromium browser tests. The public-site build includes Storybook and TypeDoc. Site checks and the dependency advisory audit run separately from `verify`. Advisory results describe the current registry data for the resolved lockfile.

## Automated coverage

| Area                      | Checks                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture              | Core compiles without DOM types or runtime dependencies; import-boundary tests reject forbidden dependencies.                                          |
| Game rules                | Global session deadline, free/guided transitions, replay without rescoring, background incidents, invalid intents, routines and reset.                 |
| Configuration             | Strict decoding, bounded loading, invalid input, local logo filenames and portable image embedding.                                                    |
| Packaging                 | Script serialization, CSP integrity, dependency license inventory, notice parity and removal of build intermediates.                                   |
| Browser behavior          | Complete HTTP and offline journeys, both languages, navigation, dialogs, drafts, timeout/reset, narrow layouts, keyboard controls, branding and About. |
| Accessibility and privacy | Axe scans in tested states, focus behavior, unexpected external requests, page errors and persistent browser storage.                                  |
| Product site              | Local links and anchors, language navigation, demo and download paths, API and Storybook loading, mobile layout and Axe scans.                         |
| Maintenance               | Knip unused-file/dependency/export checks, workflow syntax, frozen dependency installation and registry advisory audit.                                |
| Ubuntu scripts            | ShellCheck, shell/unit syntax, Python/TypeScript contract parity and sandboxed install/refusal/rollback/verification/removal tests.                    |

Only the session deadline limits play; there is no countdown for individual answers. Players cannot extend the deadline, so no WCAG timing-adjustment conformance is claimed. Operators can configure a longer session before an event.

The browser fixture serves `dist/` by default, or the directory selected by `BUILD_ROOT`, on loopback port 4183. It has no development-server fallback and does not reuse an interactive preview. Keep that port available while running the suite.

## GitHub Pages path

CI checks the assembled product site in `dist/site/` and its nested demo under the repository’s deployment path. To check the project path locally:

```sh
BASE_PATH=/shutteros-playground pnpm build:site
BUILD_ROOT=dist/site/demo BASE_PATH=/shutteros-playground/demo pnpm test:e2e
BASE_PATH=/shutteros-playground pnpm test:site
```

Use the repository's actual base path for a fork. Run `pnpm build` without `BASE_PATH` to restore a root-path kiosk build. See [Pages deployment](publishing.md) for artifact selection and hosting configuration.

## Deployment acceptance

- Exercise the deployed URL after an Actions run: login, one situation, language switching, About notices and logout. Check the browser console and asset paths.
- Rehearse with representative participants. Verify reading pace, guided duration, keyboard use, screen-reader behavior, zoom, touch input and the target screen resolution. Chromium automation and Axe scans do not establish accessibility conformance or test every browser.
- Test session expiry, cancelled logout and process recovery on the kiosk. Confirm that the facilitator can reach the organisation's support contact through its usual channel.
- The Ubuntu kit has been exercised in a resource-limited KVM guest, including PAM/logind, Cage, Chromium Snap, recovery and uninstall. Complete its [hardware acceptance and recovery checks](ubuntu-kiosk.md#install-and-verify) on the target machine; virtual graphics and keyboard tests do not qualify its GPU, peripherals or firmware controls.
- Review the distributable files. Keep `LICENSE` and dependency notices, use fictional game data, and exclude private organisation assets from a generic public demo.

Host access logs, HTTP security headers, browser policy and physical access are deployment responsibilities. The application's meta CSP cannot enforce a framing policy. See [security](../SECURITY.md) and [licensing and privacy](legal.md).
