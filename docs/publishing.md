# GitHub publication

The source is a personal MIT project. The public demo uses the generic ShutterOS identity and fictional content. Keep an organisation's build and logo separate from the public demo.

## First publication

1. Create the intended GitHub repository. Review `git status --short` and the files to be committed before the first push. Do not add `private/`, generated branding, `.env` files, `dist/`, local browser reports, or operator notes. `.gitignore` is a convenience; it does not protect files that have already been tracked or force-added.
2. Install Node 24 and the pinned pnpm 11.19.0. Run `pnpm install --frozen-lockfile`, install Playwright's Chromium with `pnpm exec playwright install chromium --only-shell`, then run `pnpm verify` and `pnpm build:storybook`.
3. The initial Git repository is prepared locally with author François Cabouat, `main` and `develop`, and `origin` set to `https://github.com/fcabouat/cyber-shutteros.git`. Review the initial commit, then push `main` and `develop` yourself (`git push -u origin main` and `git push -u origin develop`). Push the source to the intended repository and inspect the **Verify and publish** Actions run. Every push and pull request verifies the application and tests the Pages artifact under its actual repository path.
4. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Add the repository Actions variable **`PAGES_ENABLED` = `true`** under **Settings → Secrets and variables → Actions → Variables**.
5. Run **Verify and publish** manually on the default branch, or push a new commit to it. The deployment job runs only after verification succeeds, only on the default branch, and only when the variable is enabled. Pull requests never deploy.
6. Open the URL reported by the `github-pages` deployment. Verify login, one situation, language switching, logout, and the browser console on that URL. A local passing build is not evidence that the remote deployment has completed.

The workflow uses pinned action revisions, a frozen lockfile, Node 24, dependency advisory checking, lint, formatting, type checks, unit tests, static and portable builds, Chromium end-to-end tests, and a Storybook build. Only the deployment job receives Pages write and OIDC permissions. It deploys the same Pages artifact that passed the browser tests; it does not rebuild after verification.

## Paths and artifacts

The workflow derives `/repository-name` for a project site and an empty base for an `owner.github.io` repository. This follows [SvelteKit's static Pages guidance](https://svelte.dev/docs/kit/adapter-static#GitHub-Pages). It supports the standard GitHub Pages URL. A custom domain needs an explicit base-path adjustment and a fresh test; it is not configured by this workflow.

The **shutteros-static-and-portable** Actions artifact contains the root-path build for a local kiosk. The **github-pages** artifact contains the separately verified site with the Pages base path. Do not copy the project-path Pages artifact to a server's root URL: use the kiosk artifact instead.

To reproduce the project-path verification locally:

```sh
BASE_PATH=/shutteros-preview pnpm build
BASE_PATH=/shutteros-preview pnpm test:e2e
```

The browser test fixture serves only files from `dist/` on loopback port 4183, under that exact prefix. It has no SPA fallback and never reuses the interactive preview on port 4173. To return to the normal local build, run `pnpm build` without `BASE_PATH`.

GitHub documents the required publishing source, artifact, permissions, and environment in [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Maintenance and release review

- Protect the default branch with the `verify` status check once Actions has run. Review dependency update pull requests; advisory databases and action revisions change over time.
- Enable GitHub private vulnerability reporting if the repository supports it, or provide a private reporting contact in `SECURITY.md`.
- Rehearse with representative players and the target kiosk before a public event. Automated accessibility checks do not replace keyboard, screen-reader, zoom, and comprehension testing with people.
- Keep the generic published demo free of organisation-owned assets. Private branding is included in built HTML, so an organisation's `dist/` is not a public-safe artifact by default.
- Use a release tag when distributing a validated version. Attach the root-path kiosk artifact if a downloadable build is useful; retain its `LICENSE` and dependency notices.
