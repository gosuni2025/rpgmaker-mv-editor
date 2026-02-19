import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.SERVER_PORT || '3001';
const clientPort = parseInt(process.env.CLIENT_PORT || '5173');
const serverBase = `http://localhost:${serverPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: clientPort,
    proxy: {
      '/api': serverBase,
      '/game': serverBase,
      '/img': serverBase,
      '/data': serverBase,
      '/audio': serverBase,
      '/plugins': serverBase,
      '/runtime': serverBase,
    },
  },
});
