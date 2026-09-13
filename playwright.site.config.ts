import { defineConfig, devices } from '@playwright/test';

const basePath = process.env.BASE_PATH ?? '';

export default defineConfig({
  testDir: './tests/site',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
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
    env: { BUILD_ROOT: 'dist/site', BASE_PATH: basePath },
  },
});
