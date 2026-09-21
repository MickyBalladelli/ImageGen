import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.CLIENT_PORT || 5173),
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000' },
  },
});
