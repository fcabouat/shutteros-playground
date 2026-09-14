import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Storybook consumes the component package without SvelteKit routes or its build plugins.
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte({
      configFile: fileURLToPath(
        new URL('../packages/components/svelte.config.js', import.meta.url),
      ),
    }),
  ],
});
