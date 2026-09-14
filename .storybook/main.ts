import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.svelte'],
  addons: ['@storybook/addon-svelte-csf'],
  framework: '@storybook/sveltekit',
  core: { disableTelemetry: true },
};

export default config;
