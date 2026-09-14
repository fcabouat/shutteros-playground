# Contributing

Thanks for improving ShutterOS. Keep the project a small, local, static awareness game.

## Development

Use Node.js 22.13 or later (Node 24 is used in CI) and pnpm 11.19.0. Install from the lockfile:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The first `check` generates local branding and framework types for the editor. Development and preview bind to loopback; pass `--host 0.0.0.0` explicitly when LAN access is needed.

Useful commands are `pnpm dev`, `pnpm test`, `pnpm check`, `pnpm lint`, and `pnpm build`. Run the checks relevant to a change before opening a pull request; see [verification](docs/verification.md) for the full release workflow.

After that installation, Bun remains a supported manual runner for individual development scripts, for example `bun run dev`, `bun run build`, `bun run check`, `bun run test`, and `bun run knip`. Keep Node installed. `bun test` runs a different test runner; use `bun run test` for Vitest. Use pnpm for dependency changes, Gitflow hooks, and the full `verify` and release workflows, retaining the single committed pnpm lockfile.

Knip runs in `verify` and detects unused files, dependencies and exports across the application and core workspace. Framework entry points come from its plugins; `knip.jsonc` declares the test-server and static-site assets loaded outside imports, and checks core entry exports. Remove unused code or document a real entry point instead of adding broad ignore rules.

## Scope and design

Keep `packages/core` independent of Svelte, the DOM, storage, system time, and package dependencies. It is a standalone workspace package so the rules can be type-checked separately from the browser application. Keep the versioned external JSON contract in `src/lib/contract` independent of `@shutteros/core`. The independently checked `packages/components` package renders props and emits intents; it does not import application or infrastructure modules or contain game outcomes or timing rules. Preserve the state-machine invariants: absolute deadlines, monotonic time, no duplicate result for a challenge, and a full reset on logout or global expiry.

Do not add real credential collection, network-backed scenarios, trackers, persistence, external embeds, CDNs, or claims that the page provides operating-system isolation. Do not turn the fictional content into a real assessment of participants.

## Code comments

Document the reasoning a reader cannot recover from names and types: state ownership and lifetime, boundary assumptions, ordering constraints, failure policy, and non-obvious product rules. Put a short contract beside a module or public operation when it helps callers; keep detailed explanations next to the relevant decision. Straightforward helpers and declarative markup do not need narration.

Comments describe current behavior, without design history or superseded alternatives. A guarantee such as “never”, “every” or “exactly” must identify its structural mechanism or a test that demonstrates the stated scope. Test comments explain why a fake or boundary value matters rather than repeating the test name. Update the explanation with the implementation; do not add a comment-count gate.

## Content changes

Write game-facing content, the product site and the player guide in both French and English; keep technical documentation in English. Keep lessons short and supported by the official sources in `docs/content.md`. Preserve important nuance: a dedicated media-inspection station reduces exposure but is not a safety guarantee; a legitimate delegation can change a sender address; a signature does not make content harmless; and HTTPS alone does not prove that a destination is the intended service.

Use fictional data only. Configuration passwords are public game phrases, never production credentials. A new or modified configuration field needs strict contract validation, a mapping to runtime configuration, and relevant unit tests.

## Pull requests

Describe the user-visible change, the invariant or content source that supports it, and the validation run. Keep changes focused. Do not mix generated build output, unrelated formatting, or kiosk-host policy with application logic.

The workspace overrides `cookie@<0.7.0` to `0.7.2` for [GHSA-pxg6-pf52-xh8x](https://github.com/advisories/GHSA-pxg6-pf52-xh8x). It is a SvelteKit server dependency, absent from the delivered browser bundle; remove this override when upstream no longer selects the affected range.

Dependabot checks version updates monthly, grouped into application dependencies, development tools and GitHub Actions. Its limits are two npm PRs and one Actions PR at a time. Security alerts and security-update PRs have separate GitHub settings; see [publishing](docs/publishing.md#public-repository-security).

## Git workflow

`main` contains the reviewed distributable version; `develop` is the integration branch. Work on `feature/<topic>` or `bugfix/<topic>` branches and open a pull request into `develop`; squash or rebase merging is suitable for these working branches. Release and hotfix finishes retain merge commits. Releases and hotfixes are made locally with git-flow (`release/<version>`, `hotfix/<version>`, tags `v<version>`, `support/` for maintained lines) as described in the [publishing guide](docs/publishing.md#releases-with-git-flow). Run `pnpm gitflow:init` once per clone to configure the client and its tracked hooks. The initializer refuses to overwrite an existing hook that is not already the exact tracked link.

## Dependency notices

The build compares its actual redistributed dependency inventory with `static/THIRD-PARTY-NOTICES.txt`, which also makes notices available in development. If a dependency update makes the build report stale notices, run `pnpm notices:update` against those build intermediates, review the notice changes, then rerun `pnpm build` and the checks. Always distribute only a completely successful build.
