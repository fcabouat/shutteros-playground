import type { StorybookConfig } from '@storybook/svelte-vite';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.svelte'],
  addons: ['@storybook/addon-svelte-csf'],
  framework: {
    name: '@storybook/svelte-vite',
    options: {
      builder: { viteConfigPath: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) },
    },
  },
  core: { disableTelemetry: true },
};

export default config;
