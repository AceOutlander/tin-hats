import { defineConfig } from 'vite';

// base './' keeps every asset URL relative so the build can be dropped into a
// Capacitor webview (file-style origin) as well as served from any sub-path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
  server: { host: true },
  preview: { host: true },
});
