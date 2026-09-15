import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { bundleInventory } from './scripts/bundle-inventory.ts';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), bundleInventory()],
  server: {
    port: 5173,
    strictPort: true,
    // SvelteKit allows app sources by default; shared workspace sources live here.
    fs: { allow: [fileURLToPath(new URL('./packages', import.meta.url))] },
  },
  preview: { port: 4173, strictPort: true },
});
