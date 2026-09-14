import { execFileSync } from 'node:child_process';

export function releaseAppIdentity() {
  const token = process.env.RELEASE_PR_TOKEN;
  const slug = process.env.RELEASE_APP_SLUG;
  if (!token) throw new Error('Expected RELEASE_PR_TOKEN for release pull request creation.');
  if (!/^[a-z\d](?:[a-z\d-]{0,98}[a-z\d])?$/i.test(slug ?? ''))
    throw new Error('Expected RELEASE_APP_SLUG.');
  return { author: `${slug}[bot]`, token };
}

export function createReleasePull({ head, base, title, body }) {
  const { token } = releaseAppIdentity();
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Expected GITHUB_REPOSITORY.');
  const environment = { ...process.env };
  delete environment.RELEASE_PR_TOKEN;
  // The pull-request endpoint needs only Pull requests: write and avoids
  // the repository discovery performed by higher-level PR commands.
  return execFileSync(
    'gh',
    [
      'api',
      '--method',
      'POST',
      `repos/${repository}/pulls`,
      '-f',
      `head=${head}`,
      '-f',
      `base=${base}`,
      '-f',
      `title=${title}`,
      '-f',
      `body=${body}`,
      '--jq',
      '.html_url',
    ],
    {
      encoding: 'utf8',
      env: { ...environment, GH_TOKEN: token },
    },
  ).trim();
}
