import { buildRoot, projectRoot } from './scripts/build-paths.mjs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { bundleInventory } from './scripts/bundle-inventory.ts';

export default defineConfig(({ command }) => ({
  // Prerender executes outside the checkout, where Node cannot resolve its packages.
  // Bundle SSR dependencies for the static build; retain Kit's dev externalization.
  ssr: command === 'build' ? { noExternal: true } : undefined,
  build: { emptyOutDir: true },
  cacheDir: `${buildRoot}/cache/vite`,
  resolve: { alias: { $generated: `${buildRoot}/generated` } },
  plugins: [tailwindcss(), sveltekit(), bundleInventory()],
  server: {
    port: 5173,
    strictPort: true,
    // Only generated application code may be served from the sibling build tree.
    fs: { allow: [projectRoot, `${buildRoot}/generated`, `${buildRoot}/svelte-kit`] },
  },
  preview: { port: 4173, strictPort: true },
}));
