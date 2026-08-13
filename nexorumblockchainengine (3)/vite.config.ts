import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  // @solana/web3.js (and its deps) expect a couple of Node globals that
  // Vite doesn't provide in the browser by default. `Buffer` itself is
  // polyfilled explicitly in src/polyfills.ts (import order matters there);
  // `global` just needs to resolve to `globalThis`.
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
