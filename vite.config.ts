import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
    // Windows native file events can miss external edits and serve mismatched game modules.
    watch: { usePolling: true, interval: 250 },
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
