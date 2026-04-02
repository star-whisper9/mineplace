import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mineplace/',
  server: {
    fs: {
      // Allow serving textures from dev-docs during development
      allow: ['..'],
    },
  },
});
