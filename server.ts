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
    path.resolve(__dirname, 'CityWorld.html'),
    path.resolve(__dirname, 'dist', 'CityWorld.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (asDownload) {
      res.setHeader('Content-Disposition', 'attachment; filename="CityWorld.html"');
    }
    res.sendFile(filePath);
  };

  // Serve raw standalone CityWorld.html before Vite/SPA middleware so it is never cached or modified
  app.get('/CityWorld.html', sendStandaloneHtml(false));
  app.get('/api/download-html', sendStandaloneHtml(true));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
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
