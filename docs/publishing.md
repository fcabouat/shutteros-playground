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

## Release from develop

Merge feature and dependency PRs into `develop` as usual. Include a `pnpm changeset` note for releasable changes. These merges do not trigger a release.

When you decide to publish, switch to a clean local `develop` and run:

```sh
pnpm release patch
# or: pnpm release minor
```

The command fast-forwards your local branch if necessary, starts GitHub Actions, and exits. You can close the terminal immediately. You can also use **Actions → Verify and publish → Run workflow**, choose **develop**, enable **prepare_release**, and choose **release_type**. There is no need to wait for the preceding develop CI run: the release workflow verifies the requested commit itself.

The requested type is a minimum: stronger pending Changesets take precedence. With no argument, `pnpm release` uses only the pending Changesets; without any, it creates no release. Explicit patch/minor/major requests also work without a prewritten note.

This is the decision to publish, not just to draft a PR. GitHub then:

1. Verifies develop and lets Changesets calculate the version and changelog.
2. Creates `release/X.Y.Z` and its PR to `main`, tests the proposed merge, waits for required checks, and merges with a merge commit.
3. Verifies main, creates the tag and GitHub release, and deploys Pages when enabled.
4. Opens, verifies and merges a return PR from the same release branch into `develop`.

The technical PRs remain visible; normal delivery needs no further manual merge. Failed checks, conflicts or branch changes stop the affected stage. A prepared release is reused on retry, and published tags are never moved. If a release is already in progress, another request resumes that delivery rather than cutting a second one.

### Repository setup

Install GitHub CLI (`gh`) and run `gh auth login` once for the local launcher. Under **Settings → Actions → General**, allow Actions to create pull requests. Allow merge commits, keep `verify` required on `main` and `develop`, and permit Actions to create version tags. Required human reviews or environment approvals will still pause delivery; for this solo-maintainer workflow, leave their required count at zero. No admin bypass is used.

The built-in Actions token needs no stored personal token. Each bot merge explicitly dispatches the next workflow because token-authored pushes do not normally trigger another run. If a separate required workflow, such as CodeQL, awaits approval, approve it in GitHub; the release does not bypass that check. See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

### Recovery and publication status

Run `pnpm release` again from develop to resume preparation or an open delivery/return PR. If develop advanced during initial verification, rerun to include and verify its new head. For a transient job failure, rerun the failed job; for a moved PR base, start a new run so the proposed merge is tested again. The internal **release_pr** input identifies that PR when dispatching on its `release/X.Y.Z` branch.

To resume an interrupted publication, run **Verify and publish** on current `main` with **resume_release** enabled. It reuses completed stages and requires the version tag, if present, to identify that exact main commit. An already-tagged version with changed content needs a new release. Rerunning an old job retains its old workflow code.

Check **verification, CodeQL, Pages, tag/release creation, and the return PR separately**. A green `verify` is not proof that delivery finished. Pages and release publication are independent because kiosk use does not require Pages. Actions summaries provide the publication and PR links.

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
