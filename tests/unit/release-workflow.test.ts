import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const job = (name: string) => {
  const section = workflow.split(`\n  ${name}:\n`)[1];
  if (!section) throw new Error(`Missing job: ${name}`);
  return section.split(/\n {2}[\w-]+:\n/)[0] ?? '';
};

// Script tests model GitHub responses; these contracts cover the workflow boundary
// where a PR's synthetic merge SHA differs from the head the controller must check.
test('PR verification passes the actual head and tested base to the merge controller', () => {
  expect(job('verify')).toContain(
    'EXPECTED_HEAD: ${{ github.event.pull_request.head.sha || github.sha }}',
  );
  expect(job('verify')).toContain('test "$(git rev-parse HEAD^2)" = "$EXPECTED_HEAD"');
  expect(job('verify')).toContain('base=$(git rev-parse HEAD^1)');
  expect(job('merge-release')).toContain(
    'RELEASE_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}',
  );
  expect(job('merge-release')).toContain(
    'VERIFIED_BASE_SHA: ${{ needs.verify.outputs.release_base }}',
  );
});

test('PR checks and merging do not receive the App key or its PR creation token', () => {
  for (const name of ['verify', 'merge-release']) {
    expect(job(name)).not.toMatch(
      /RELEASE_APP_PRIVATE_KEY|RELEASE_PR_TOKEN|create-github-app-token/,
    );
  }
  expect(job('merge-release')).toContain(
    'github.event.pull_request.head.repo.full_name == github.repository',
  );
  expect(job('merge-release')).toContain(
    "github.event.pull_request.user.login == format('{0}[bot]', vars.RELEASE_APP_SLUG)",
  );
  for (const name of ['prepare-release', 'release']) {
    const section = job(name);
    expect(section).toContain('repositories: ${{ github.event.repository.name }}');
    expect(section).toContain('permission-pull-requests: write');
    expect(section).not.toMatch(/permission-(contents|actions|workflows): write/);
    expect(section.indexOf('Check the configured release identity')).toBeLessThan(
      section.indexOf('run: node scripts/'),
    );
  }
});

test('ordinary verification and recovery serialize on the same PR number', () => {
  expect(workflow).toContain(
    'group: ${{ github.workflow }}-${{ github.event.pull_request.number || inputs.release_pr || github.ref }}',
  );
});
