import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: '/index.dev.html',
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.dev.html'),
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  // Em dev, servir index.dev.html como página principal
  appType: command === 'serve' ? 'mpa' : 'spa',
}));
