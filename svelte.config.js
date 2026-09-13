import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ pages: 'dist', assets: 'dist', strict: true }),
    paths: { base: process.env.BASE_PATH ?? '' },
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        // Vite's dev client uses a blob SharedWorker to reconnect after a restart.
        // Published builds do not ship that client and keep the script-src fallback.
        ...(process.env.NODE_ENV === 'development' ? { 'worker-src': ['self', 'blob:'] } : {}),
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['none'],
      },
    },
  },
};
