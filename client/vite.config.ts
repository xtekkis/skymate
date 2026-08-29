import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    // The components under test render, focus and receive keystrokes, so they
    // need a DOM rather than a mocked stand-in for one.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // No globals: a test file imports describe and expect like any other
    // module, so tsc checks it without ambient types leaking into the build.
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
