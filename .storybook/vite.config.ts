import { projectRoot, buildRoot } from '../scripts/build-paths.mjs';
import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Storybook consumes the component package without SvelteKit routes or its build plugins.
export default defineConfig({
  cacheDir: `${buildRoot}/cache/storybook`,
  server: { fs: { allow: [projectRoot, `${buildRoot}/generated`] } },
  resolve: { alias: { $generated: `${buildRoot}/generated` } },
  plugins: [
    tailwindcss(),
    svelte({
      configFile: fileURLToPath(
        new URL('../packages/components/svelte.config.js', import.meta.url),
      ),
    }),
  ],
});
