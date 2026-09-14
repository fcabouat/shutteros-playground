import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vite';
import { bundleInventory } from './scripts/bundle-inventory.ts';

export default defineConfig({
  root: 'portable',
  base: './',
  plugins: [tailwindcss(), svelte({ configFile: false }), bundleInventory(), viteSingleFile()],
  build: { outDir: '../dist/portable', emptyOutDir: true, target: 'es2022' },
});
