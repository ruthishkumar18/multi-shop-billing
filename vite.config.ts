import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import http from 'node:http';
import { defineConfig, type Plugin } from 'vite';

import fs from 'node:fs';

function apiProxyPlugin(): Plugin {
  return {
    name: 'api-backend-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/dist.zip' || req.url === '/MultiShopBilling_Portable.zip') {
          const filePath = path.resolve(import.meta.dirname, 'public', req.url.slice(1));
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Length': stat.size,
              'Content-Disposition': `attachment; filename="${req.url.slice(1)}"`,
            });
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 5000,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              host: '127.0.0.1:5000',
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', () => {
          // Gracefully respond when Flask backend on port 5000 is offline
          // without triggering unhandled Vite proxy error logging
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            if (req.url?.startsWith('/api/database/status')) {
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  connected: false,
                  offline: true,
                  message: 'Local browser storage active (Start Flask on port 5000 for MySQL synchronization)',
                })
              );
            } else if (req.url?.startsWith('/api/database/bootstrap')) {
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  success: true,
                  offline: true,
                  users: [],
                  profiles: [],
                  products: [],
                  bills: [],
                })
              );
            } else if (req.url?.startsWith('/api/database/sync')) {
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  success: true,
                  offline: true,
                  message: 'Saved to browser cache (Start Flask on port 5000 for disk database).',
                })
              );
            } else {
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  success: false,
                  offline: true,
                  message: 'Backend server offline; data cached in localStorage.',
                })
              );
            }
          }
        });

        proxyReq.setTimeout(4000, () => {
          proxyReq.destroy();
        });

        if (req.readableEnded) {
          proxyReq.end();
        } else {
          req.pipe(proxyReq);
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
