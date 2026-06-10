import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/apirest': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/apirest/, '/glpi/apirest.php'),
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
            if (req.headers['app-token']) {
              proxyReq.setHeader('App-Token', req.headers['app-token']);
            }
            if (req.headers['session-token']) {
              proxyReq.setHeader('Session-Token', req.headers['session-token']);
            }
          });
        },
      },
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '/glpi/api.php/v2.3'),
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
            if (req.headers['app-token']) {
              proxyReq.setHeader('App-Token', req.headers['app-token']);
            }
          });
        },
      },
      '/settings': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/history': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});