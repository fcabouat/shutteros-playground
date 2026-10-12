import { buildRoot, distPath } from './scripts/build-paths.mjs';
import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.BASE_PATH ?? '';

export default defineConfig({
  outputDir: `${buildRoot}/test-results/site`,
  testDir: './tests/site',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: `${buildRoot}/playwright-report/site` }],
  ],
  use: {
    baseURL: `http://127.0.0.1:4183${basePath}/`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: 'node tests/e2e/serve-build.mjs',
    url: `http://127.0.0.1:4183${basePath}/`,
    reuseExistingServer: false,
    env: { BUILD_ROOT: distPath('site'), BASE_PATH: basePath },
  },
});
