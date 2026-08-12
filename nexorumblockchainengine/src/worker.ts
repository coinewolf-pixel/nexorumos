/// <reference types="@cloudflare/workers-types" />

import { handleApiRequest } from './api/router';
import { NEXORUMEngine } from './core/managers/BlockchainManager';

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  ETHEREUM_RPC_KEY: string;
  SOLANA_RPC_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Boot engine on first request
    await NEXORUMEngine.bootEngine();

    // Serve static assets in production (optional)
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }

    // Simple HTML fallback for root
    if (url.pathname === '/') {
      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>NEXORUM OS — Blockchain Engine</title></head>
<body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px">
  <h1>⛓️ NEXORUM OS — Blockchain Engine</h1>
  <p>Edge-deployed blockchain infrastructure. API available at <code>/api/v1/*</code></p>
  <h2>Endpoints</h2>
  <ul>
    <li><code>GET /api/v1/health</code> — Health check</li>
    <li><code>GET /api/v1/networks</code> — Active networks</li>
    <li><code>GET /api/v1/rpc/status</code> — RPC benchmark</li>
    <li><code>POST /api/v1/transactions/simulate</code> — Simulate tx</li>
    <li><code>POST /api/v1/tokens/create</code> — Token launchpad</li>
    <li><code>GET /api/v1/portfolio/:address</code> — Portfolio</li>
  </ul>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
