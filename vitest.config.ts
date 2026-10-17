import { buildRoot } from './scripts/build-paths.mjs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: `${buildRoot}/cache/vitest`,
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $generated: `${buildRoot}/generated`,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'packages/core/tests/**/*.test.ts'],
    environment: 'node',
  },
});
