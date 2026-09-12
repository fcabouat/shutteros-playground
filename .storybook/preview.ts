import type { Preview } from '@storybook/sveltekit';
import '../src/lib/components/theme.css';

const preview: Preview = {
  parameters: { layout: 'fullscreen', controls: { expanded: true } },
};
export default preview;
