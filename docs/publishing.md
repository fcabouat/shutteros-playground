# GitHub Pages deployment

The source is a personal MIT project. The public demo uses the generic ShutterOS identity and fictional content. Keep an organisation's build and logo separate from the public demo.

## Configure Pages

1. Use a GitHub repository with Actions enabled, `develop` as its default integration branch, and `main` for releases and Pages. Forks can use the same workflow; the deployment path is derived from the repository name.
2. Run the [release verification](verification.md) from a clean checkout. Check that the source excludes organisation assets, generated branding, `.env` files, `dist/`, and local browser reports.
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Add the repository Actions variable **`PAGES_ENABLED` = `true`** under **Settings → Secrets and variables → Actions → Variables**.
4. Run **Verify and publish** manually on `main`, or push a commit to it. The deployment job runs only after verification succeeds, only on `main`, and only when the variable is enabled. Pull requests never deploy.
5. In **Settings → Environments → github-pages**, restrict deployment branches to `main`.
6. Inspect the Actions run and open the URL reported by the `github-pages` deployment. Verify login, one situation, language switching, logout, and the browser console on that URL.

The workflow uses pinned action revisions, a frozen lockfile, Node 24, dependency advisory checking, lint, formatting, type checks, Knip, unit tests, static and portable builds, Chromium end-to-end tests, and a Storybook build. Pull requests run verification; pushes run it only on `main` and `develop`, avoiding duplicate runs on working branches. Only the deployment job receives Pages write and OIDC permissions. It deploys the same Pages artifact that passed the browser tests; it does not rebuild after verification.

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

These paths sit below the repository prefix on a project Pages site. The previous root demo URL now opens the product page, whose primary action opens the game. Direct kiosk URLs and downloads continue to use the game-only build. Language links are ordinary URLs, without cookies or stored preferences; English-only technical references are marked as such.

To reproduce the project-path verification locally:

```sh
BASE_PATH=/shutteros-preview pnpm build:site
BUILD_ROOT=dist/site/demo BASE_PATH=/shutteros-preview/demo pnpm test:e2e
BASE_PATH=/shutteros-preview pnpm test:site
```

The browser test fixture serves only the selected build directory on loopback port 4183, under that exact prefix. It has no SPA fallback and never reuses the interactive preview on port 4173. Site checks exercise language navigation, the download, demo, guide, API and Storybook, including mobile layout and automated accessibility checks. To preview manually at a root URL, run `pnpm build:site` without `BASE_PATH`, then `python3 -m http.server 4174 --bind 127.0.0.1 --directory dist/site`.

GitHub documents the required publishing source, artifact, permissions, and environment in [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Prepare a release

Install GitHub CLI (`gh`) and run `gh auth login` once. In repository **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. Keep branch protections and required `verify` checks; the automation does not merge PRs. Tag rules must allow Actions to create `v*` tags.

Include `pnpm changeset` and its short English release note in each releasable feature or fix PR. The application and core share one version. After these PRs are merged into `develop`, use a clean checkout:

```sh
git switch develop && git pull --ff-only
pnpm release:prepare
pnpm release:push
```

Preparation plans the next version with Changesets and builds `release/X.Y.Z` in a temporary worktree. Failed versioning, formatting or commits leave `develop` and its changesets unchanged; fix the cause and rerun the same command. An existing release branch is never replaced. Successful preparation switches to the committed release branch. The push command opens a release PR into `main`; retry it safely if PR creation fails. Accept that PR with **Create a merge commit** after `verify` and CodeQL pass. The main push runs verification, publishes Pages when enabled, creates the immutable `vX.Y.Z` tag and GitHub release, and opens a `main` → `develop` synchronization PR. Accept that PR with **Create a merge commit** too; do not delete `main`. Rebase is fine for feature PRs into `develop`, but avoid squash/rebase for these two release merges.

The synchronization PR is created using `GITHUB_TOKEN`; approve its workflows if GitHub requests it. The workflow also explicitly dispatches verification on `main`. No personal token is stored in Actions. The publication summary reports verification, Pages and release separately. A green `verify` is not proof of publication: follow the tag/release links in the release job summary and check the Pages deployment and CodeQL result. Pages and release publication are independent because the portable/kiosk distribution remains useful without Pages. Resolve synchronization conflicts normally before starting the next release.

### Recover an incomplete publication

For a transient failure, rerun the failed release job. To run corrected workflow code, start a **new** run of **Verify and publish** on current `main` and enable **resume_release** (CLI: `gh workflow run ci.yml --ref main -f resume_release=true`). This reruns verification before publication; ordinary manual verification leaves release publication disabled.

The publisher accepts the current main version if no tag exists, or resumes an existing tag only when it resolves to that exact commit. It never moves a published tag. If a code fix is needed after tagging, prepare a new patch release. Merge any workflow fix through a reviewed PR first: rerunning an old job uses its old workflow. Existing tags/releases/PRs are reused, and permissions/API failures remain failures rather than being treated as absence. A draft release must be reviewed and published before retrying.

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
deletion, and require `verify`. For a solo maintainer, required PRs can use zero
required approvals; do not require an approval the author cannot provide.
