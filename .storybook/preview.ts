import type { Preview } from '@storybook/svelte-vite';
import '@shutteros/components/theme.css';

const preview: Preview = {
  parameters: { layout: 'fullscreen', controls: { expanded: true } },
};
export default preview;
