import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// SmartPrint frontend.
// The dev server proxies /api to a future Express backend (see server/README).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      // When the Node.js/Express API is added, it will run on :5000.
      // Until then requests are handled by the in-memory mock service layer.
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
