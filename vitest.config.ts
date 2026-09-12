import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'packages/core/tests/**/*.test.ts'],
    environment: 'node',
  },
});
