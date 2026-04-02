import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      // Allow serving textures from dev-docs during development
      allow: ['..'],
    },
  },
});
