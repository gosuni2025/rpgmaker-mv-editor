import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/game': 'http://localhost:3001',
      '/img': 'http://localhost:3001',
      '/data': 'http://localhost:3001',
      '/plugins': 'http://localhost:3001',
    },
  },
});
