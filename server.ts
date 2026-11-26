import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CityWorldMultiplayerServer } from './src/server/multiplayerServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function resolveStandaloneHtmlPath(): string | null {
  const candidates = [
    path.resolve(__dirname, 'dist', 'CityWorld.html'),
    path.resolve(__dirname, 'CityWorld.html'),
  ].filter((p) => fs.existsSync(p));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    try {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });
  return candidates[0];
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Allow standalone CityWorld.html (file://) and Android APK WebViews to reach API routes when hosted
  app.use('/api', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const httpServer = http.createServer(app);
  const mpServer = new CityWorldMultiplayerServer();
  mpServer.registerRoutes(app);
  mpServer.attachToHttpServer(httpServer);

  const sendStandaloneHtml = (asDownload: boolean) => (_req: express.Request, res: express.Response) => {
    const filePath = resolveStandaloneHtmlPath();
    if (!filePath) {
      res.status(404).send('CityWorld.html not built yet.');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (asDownload) {
      res.setHeader('Content-Disposition', 'attachment; filename="CityWorld-v8.html"');
    }
    res.sendFile(filePath, { etag: false, lastModified: false });
  };

  // Serve raw standalone CityWorld.html before Vite/SPA middleware so it is never cached or modified
  app.get('/CityWorld.html', sendStandaloneHtml(false));
  app.get('/api/download-html', sendStandaloneHtml(true));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : { server: httpServer },
      },
      plugins: disableHmr
        ? [
            {
              name: 'disable-vite-client-ws',
              enforce: 'post',
              transform(code, id) {
                if (id.replace(/\\/g, '/').endsWith('/vite/dist/client/client.mjs')) {
                  return code
                    .replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* Vite HMR WebSocket disabled (DISABLE_HMR=true) */'
                    )
                    .replace(
                      'ws.send(JSON.stringify(data));',
                      'if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));'
                    )
                    .replace(
                      'wsTransport.send(data);',
                      'return Promise.resolve(wsTransport.send(data));'
                    )
                    .replace(
                      'setupForwardConsoleHandler(transport, forwardConsole);',
                      '/* Vite forwardConsole disabled (DISABLE_HMR=true) */'
                    );
                }
              },
            },
          ]
        : [],
      appType: 'spa',
    });
    if (disableHmr) {
      const cleanupSwJs = [
        'self.addEventListener("install", function () { self.skipWaiting(); });',
        'self.addEventListener("activate", function (event) {',
        '  event.waitUntil((async function () {',
        '    try {',
        '      var keys = await caches.keys();',
        '      await Promise.all(keys.map(function (k) { return caches.delete(k); }));',
        '      await self.registration.unregister();',
        '    } catch (_e) {}',
        '  })());',
        '});',
      ].join('\n');

      const sendCleanupSw = (_req: express.Request, res: express.Response) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(cleanupSwJs);
      };

      app.get('/dev-sw.js', sendCleanupSw);
      app.get('/sw.js', sendCleanupSw);
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CityWorld server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CityWorld server:', err);
  process.exit(1);
});
