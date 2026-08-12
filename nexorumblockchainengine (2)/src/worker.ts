/// <reference types="@cloudflare/workers-types" />

import { handleApiRequest } from './api/router';
import { NEXORUMEngine } from './core/managers/BlockchainManager';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  ETHEREUM_RPC_KEY: string;
  SOLANA_RPC_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Boot engine on first request
    await NEXORUMEngine.bootEngine();

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }

    // Everything else is the built React app (index.html + JS/CSS bundle),
    // served straight from the `dist/` output via the Assets binding
    // configured in wrangler.toml. `not_found_handling =
    // "single-page-application"` there makes client-side routes (e.g.
    // /launchpad, /portfolio/xyz) fall back to index.html instead of 404ing.
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback only hit if the [assets] binding isn't configured — normally
    // means `wrangler.toml` was hand-edited without it, or `npm run build`
    // wasn't run before deploy.
    return new Response(
      'NEXORUM OS: статический фронтенд не найден. Убедитесь, что перед деплоем выполнен `npm run build`, и что в wrangler.toml настроен блок [assets].',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  },
};
