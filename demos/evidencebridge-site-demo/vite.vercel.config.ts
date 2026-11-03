import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  build: {
    outDir: 'out',
    emptyOutDir: true,
  },
});
