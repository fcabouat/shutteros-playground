import { projectRoot, buildRoot, distPath } from './scripts/build-paths.mjs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import { bundleInventory } from './scripts/bundle-inventory.ts';

export default defineConfig({
  cacheDir: `${buildRoot}/cache/portable`,
  root: 'portable',
  base: './',
  server: { fs: { allow: [projectRoot, `${buildRoot}/generated`] } },
  resolve: { alias: { $generated: `${buildRoot}/generated` } },
  plugins: [tailwindcss(), svelte({ configFile: false }), bundleInventory(), viteSingleFile()],
  build: { outDir: distPath('portable'), emptyOutDir: true, target: 'es2022' },
});
