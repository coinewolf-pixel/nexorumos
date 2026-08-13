/**
 * NEXORUM OS — Express + Vite Hybrid Server
 * Binds to 0.0.0.0:3000 and serves both REST API and Vite UI Frontend
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleApiRequest } from './src/api/router';
import { NEXORUMEngine } from './src/core/managers/BlockchainManager';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Boot Blockchain Core
  try {
    await NEXORUMEngine.bootEngine();
    console.log('[NEXORUM] ✓ Blockchain Engine booted successfully');
  } catch (err: any) {
    console.error('[NEXORUM] ✗ Engine boot failed:', err.message);
  }

  // ─── CORS ───
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ─── API: mounted BEFORE Vite ───
  // Vite's dev middleware (appType: 'spa') serves index.html as a fallback
  // for ANY request that isn't a real file on disk — including /api/v1/*.
  // If Vite is registered first, it swallows every API call and returns
  // HTML instead of JSON. Express only invokes path-scoped middleware
  // (mounted at '/api/v1') for matching paths, so mounting the API router
  // first is always safe and doesn't affect how Vite serves /src/*.tsx or
  // other frontend assets.
  //
  // Do NOT use a global express.json() — it would break Vite's raw body
  // handling for non-API requests, so it's scoped to apiRouter only.
  const apiRouter = express.Router();
  apiRouter.use(express.json({ limit: '10mb' }));
  apiRouter.use(express.urlencoded({ extended: true, limit: '10mb' }));
  // Malformed JSON bodies throw inside body-parser before any route runs.
  // Without this, Express's default error handler returns an HTML error
  // page for a JSON API — catch it here and keep the response shape
  // consistent with every other error path.
  apiRouter.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      res.status(400).json({ success: false, error: 'Request body must be valid JSON' });
      return;
    }
    next(err);
  });

  // Web Standard API Bridge Handler — same handleApiRequest() the Cloudflare
  // Worker uses, so behavior (including GET /health) is identical in both.
  apiRouter.all('/*', async (req, res) => {
    try {
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      // Only forward headers a Web Standard Request can actually hold —
      // Node's raw IncomingHttpHeaders includes hop-by-hop / connection-level
      // entries (host, connection, content-length, transfer-encoding, ...)
      // that `undici`'s Request constructor rejects as "forbidden" headers.
      const forwardedHeaders = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) continue;
        if (value === undefined) continue;
        forwardedHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
      }

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers: forwardedHeaders,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      });

      const webRes = await handleApiRequest(webReq);
      res.status(webRes.status);
      webRes.headers.forEach((val, key) => res.setHeader(key, val));
      const bodyText = await webRes.text();
      res.send(bodyText);
    } catch (err: any) {
      console.error('[NEXORUM] API Error:', err.message);
      res.status(500).json({ success: false, error: err.message || 'API Proxy Error', timestamp: new Date().toISOString() });
    }
  });

  app.use('/api/v1', apiRouter);

  // ─── DEVELOPMENT: Vite middleware for everything else ───
  // Handles /src/*, /@vite/*, HMR websocket, and static assets.
  let vite: any = null;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // ─── PRODUCTION: static files + SPA fallback ───
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXORUM OS] 🚀 Blockchain Engine running on http://0.0.0.0:${PORT}`);
    console.log(`[NEXORUM OS] 📡 API endpoints available at /api/v1/*`);
  });
}

startServer().catch((err) => {
  console.error('[NEXORUM OS] Fatal server error:', err);
  process.exit(1);
});
