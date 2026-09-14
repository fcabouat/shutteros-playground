# GitHub Pages deployment

The source is a personal MIT project. The public demo uses the generic ShutterOS identity and fictional content. Keep an organisation's build and logo separate from the public demo.

## Configure Pages

1. Use a GitHub repository with Actions enabled, `develop` as its default integration branch, and `main` for releases and Pages. Forks can use the same workflow; the deployment path is derived from the repository name.
2. Run the [release verification](verification.md) from a clean checkout. Check that the source excludes organisation assets, generated branding, `.env` files, `dist/`, and local browser reports.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Add the repository Actions variable **`PAGES_ENABLED` = `true`** under **Settings → Secrets and variables → Actions → Variables**.
4. Run **CI** manually on `main`, or push a commit to it. The deployment job runs only after verification succeeds, only on `main`, and only when the variable is enabled. Pull requests never deploy.
5. In **Settings → Environments → github-pages**, restrict deployment branches to `main`.
6. Inspect the Actions run and open the URL reported by the `github-pages` deployment. Verify login, one situation, language switching, logout, and the browser console on that URL.

The workflow uses pinned action revisions, a frozen lockfile, Node 24, dependency advisory checking, lint, formatting, type checks, Knip, unit tests, static and portable builds, Chromium end-to-end tests, and a Storybook build. Pull requests run verification; pushes run it on `main`, `develop`, delivery branches and version tags. Only the deployment job receives Pages write and OIDC permissions. It deploys the same Pages artifact that passed the browser tests; it does not rebuild after verification.

## Paths and artifacts

The workflow derives `/repository-name` for a project site and an empty base for an `owner.github.io` repository. This follows [SvelteKit's static Pages guidance](https://svelte.dev/docs/kit/adapter-static#GitHub-Pages). It supports the standard GitHub Pages URL. A custom domain needs an explicit base-path adjustment and a fresh test; it is not configured by this workflow.

The **shutteros-static-and-portable** Actions artifact contains the root-path build for a local kiosk. The **github-pages** artifact contains `dist/site/`, the separately verified product site with the Pages base path. Do not copy the project-path Pages artifact to a server's root URL: use the kiosk artifact instead.

`pnpm build:site` builds and assembles the landing page, demo, guides, TypeDoc API and Storybook. It rebuilds the game for the nested demo URL; run `pnpm build` again before distributing a root-path kiosk build. The public layout is:

| Path                               | Content                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `/`, `/fr.html`                    | English and French product pages; the default entry follows the browser language |
| `/demo/`                           | Game, with an optional `?lang=fr` or `?lang=en` override                         |
| `/demo/portable/shutteros.html`    | Standalone download                                                              |
| `/guide/en.html`, `/guide/fr.html` | Player and facilitator guide                                                     |
| `/overview.html`, `/docs/`         | Architecture and deployment documentation in English                             |
| `/api/`                            | Core TypeScript reference, generated from source                                 |
| `/storybook/`                      | Interactive component catalog                                                    |

These paths sit below the repository prefix on a project Pages site. Direct kiosk URLs and downloads use the game-only build. Language links are ordinary URLs, without cookies or stored preferences; English-only technical references are marked as such.

To reproduce the project-path verification locally:

```sh
BASE_PATH=/shutteros-preview pnpm build:site
BUILD_ROOT=dist/site/demo BASE_PATH=/shutteros-preview/demo pnpm test:e2e
BASE_PATH=/shutteros-preview pnpm test:site
```

The browser test fixture serves only the selected build directory on loopback port 4183, under that exact prefix. It has no SPA fallback and never reuses the interactive preview on port 4173. Site checks exercise language navigation, the download, demo, guide, API and Storybook, including mobile layout and automated accessibility checks. To preview manually at a root URL, run `pnpm build:site` without `BASE_PATH`, then `python3 -m http.server 4174 --bind 127.0.0.1 --directory dist/site`.

GitHub documents the required publishing source, artifact, permissions, and environment in [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Releases with git-flow

Releases are made locally with the [git-flow AVH](https://github.com/petervanderdoes/gitflow-avh) client and its repository-tracked hooks in `.gitflow/hooks`. GitHub Actions only verifies what is pushed and publishes from the version tag; nothing on GitHub creates branches, pull requests, tags or commits. The AVH repository is archived (last release 1.12.3); the distribution packages `gitflow-avh` (Arch), `git-flow` (Debian/Ubuntu) and `git-flow-avh` (Homebrew) ship that version, which is the one these hooks are tested against.

One-time setup in each clone, after installing the client:

```sh
pnpm gitflow:init
```

This runs `git flow init` with the project conventions (`main`, `develop`, `feature/`, `bugfix/`, `release/`, `hotfix/`, `support/`, tag prefix `v`), links the tracked hooks into the git directory (relative links, so a moved clone keeps them), disables automatic pushes and selects nvie-style back-merges of the release branch into `develop`.
The initializer is idempotent when those exact links already exist. If any destination is a regular file or points somewhere else, it stops before creating links and reports the conflicting path; inspect and move that local hook yourself before rerunning it.

### Everyday work

```sh
git flow feature start <topic>      # branches from develop
git flow feature finish <topic>     # merges --no-ff into develop and deletes the branch
git push origin develop
```

Contributors without write access fork the repository and open a pull request from their feature branch into `develop`; the same CI verifies it.

### Release

```sh
(
  set -e
  git flow release start minor      # or patch, major, or an explicit X.Y.Z
  git flow release finish 0.4.0      # use the version printed by start
  git push --atomic origin main develop refs/tags/v0.4.0
)
```

`start` computes the next version from `develop`, writes it to the application, core and component package manifests, and commits `chore(release): vX.Y.Z` on `release/X.Y.Z`. `finish` first runs `pnpm verify` and stops on any failure; it then merges into `main`, creates the annotated tag `vX.Y.Z`, merges the release branch back into `develop` and deletes it. The hook prints the atomic push that publishes all three references together, or none. `SHUTTEROS_SKIP_VERIFY=1` bypasses the local verification when CI already verified the same commit; the tag is still verified by CI before publication.

### Hotfix

```sh
(
  set -e
  git flow hotfix start patch       # computes the version from main
  git flow hotfix finish 0.4.1
  git push --atomic origin main develop refs/tags/v0.4.1
)
```

The subshell stops at the first failure: never run the push after a failed start or finish. After a history rewrite, old local tags and delivery branches may still exist even after `fetch --prune`. Prefer a fresh clone, or back up and reconcile those references with the remote before starting a release. A tag collision is a stop condition, not permission to overwrite a published tag.

AVH 1.12.3 cannot read `gitflow.release.finish.ff-master` without a shell error. The initializer removes its old local setting and uses AVH's default (no fast-forward); an inherited setting causes an explicit refusal rather than modifying global configuration.

### What CI does with a push

- Any push to `main`, `develop`, `release/*`, `hotfix/*` and any pull request: the `verify` job.
- A push of `main`: after `verify`, the Pages deployment. A run whose commit is no longer the tip of `main` skips the deployment, so a re-run of an older run cannot replace a newer site.
- A push of a `v*` tag: after `verify` of that exact commit, the tag check requires an annotated tag, matching application, core and component package versions, ancestry from `main`, and the two merges of the same delivery tip into `main` and `develop`. The `release` job creates the GitHub release with generated notes, the standalone `shutteros-portable-vX.Y.Z.html` and the kiosk build `shutteros-kiosk-vX.Y.Z.zip`. If the release already exists after a partial run, a rerun uploads only missing assets and leaves existing assets untouched.

Git records tag type, commit identity, ancestry and parent relationships. Those checks establish the graph produced by this repository's configured release or hotfix finish without relying on a commit subject. Git cannot prove which client executable created an otherwise identical graph, so the local AVH test and repository instructions remain the evidence for the tool invocation itself.

A release therefore triggers two verification runs, one for `main` and one for the tag. This is deliberate: publication is gated on the verification of the published commit, not on the local hook.

### Repository settings

- `main` and `develop`: block force pushes and deletion. Do not require pull requests or status checks on them; `git flow ... finish` pushes merge commits directly and CI verifies afterwards. Dependabot and external contributions still arrive as pull requests.
- **Settings → General**: allow merge commits; automatically deleting head branches is optional (git-flow deletes release and hotfix branches itself).
- No secrets, tokens or GitHub Apps are needed: every push comes from the maintainer's own credentials.

## Maintenance and release review

- Rehearse with representative players and the target kiosk before a public event. Automated accessibility checks do not replace keyboard, screen-reader, zoom, and comprehension testing with people.
- Keep the generic published demo free of organisation-owned assets. Private branding is included in built HTML, so an organisation's `dist/` is not a public-safe artifact by default.
- Use a release tag when distributing a validated version. Attach the root-path kiosk artifact if a downloadable build is useful; retain its `LICENSE` and dependency notices.

## Public repository security

Under **Settings → Advanced Security**, enable **Private vulnerability reporting**
for the public repository. Reports arrive through **Security → Advisories**;
subscribe to security notifications so they reach the maintainer.
[GitHub's reporting instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
describe the setting and notification options.

Ordinary pull requests in a public repository are public, including Dependabot
updates. Dependabot alerts have restricted visibility; automatic security-update
PRs are a separate setting from the monthly version-update schedule. For a
confidential fix, use a draft security advisory and its
[temporary private fork](https://docs.github.com/en/code-security/tutorials/fix-reported-vulnerabilities/collaborate-in-a-fork).
Run verification locally: GitHub does not run CI in these temporary forks.

Before changing visibility, review existing issues, PRs, workflow logs and
artifacts. Rewriting branch history does not remove them, and
[Actions history becomes public](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
After the initial push, protect `main` and `develop` against force pushes and
deletion. Keep `verify` visible on every delivery push, but do not make it a
required pre-merge check that would reject the documented local Gitflow finish.
