/**
 * NEXORUM OS — API Router
 *
 * A Web Standard (Request → Response) handler so the exact same routing
 * logic runs on both the Express dev server (server.ts) and the
 * Cloudflare Worker (src/worker.ts).
 */
import { NEXORUMEngine } from '../core/managers/BlockchainManager';
import { ApiError } from '../core/utils/errors';
import { getSchemaDDL } from '../core/db/schema';
import type { SimulateTxParams, TokenCreationParams } from '../core/types';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

async function readJsonBody(request: Request): Promise<any> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function validateSimulateTx(body: any): ValidationResult<SimulateTxParams> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object' };
  const { network, from, to, value, data } = body;

  if (typeof network !== 'string' || !network.trim()) return { ok: false, error: '"network" is required' };
  if (typeof from !== 'string' || !from.trim()) return { ok: false, error: '"from" address is required' };
  if (typeof to !== 'string' || !to.trim()) return { ok: false, error: '"to" address is required' };
  if (value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, error: '"value" must be a string or number' };
  }
  if (data !== undefined && typeof data !== 'string') return { ok: false, error: '"data" must be a hex string' };

  return {
    ok: true,
    value: {
      network: network.trim().toLowerCase(),
      from: from.trim(),
      to: to.trim(),
      value: String(value ?? '0'),
      data: typeof data === 'string' ? data : undefined,
    },
  };
}

function validateTokenParams(body: any): ValidationResult<TokenCreationParams> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object' };
  const { network, name, symbol, totalSupply, decimals, owner } = body;

  if (typeof network !== 'string' || !network.trim()) return { ok: false, error: '"network" is required' };
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 64) {
    return { ok: false, error: '"name" is required (max 64 characters)' };
  }
  if (typeof symbol !== 'string' || !/^[A-Za-z0-9]{1,11}$/.test(symbol.trim())) {
    return { ok: false, error: '"symbol" must be 1-11 alphanumeric characters' };
  }
  if (totalSupply === undefined || (typeof totalSupply !== 'string' && typeof totalSupply !== 'number')) {
    return { ok: false, error: '"totalSupply" is required' };
  }
  const supplyNum = Number(totalSupply);
  if (!Number.isFinite(supplyNum) || supplyNum <= 0) {
    return { ok: false, error: '"totalSupply" must be a positive number' };
  }
  const decimalsNum = decimals === undefined || decimals === '' ? 18 : Number(decimals);
  if (!Number.isInteger(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
    return { ok: false, error: '"decimals" must be an integer between 0 and 18' };
  }
  if (typeof owner !== 'string' || !owner.trim()) return { ok: false, error: '"owner" address is required' };

  return {
    ok: true,
    value: {
      network: network.trim().toLowerCase(),
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      totalSupply: String(totalSupply),
      decimals: decimalsNum,
      owner: owner.trim(),
    },
  };
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const prefixIndex = url.pathname.indexOf('/api/v1');
  let path = prefixIndex >= 0 ? url.pathname.slice(prefixIndex + '/api/v1'.length) : url.pathname;
  if (!path) path = '/';
  const method = request.method.toUpperCase();

  try {
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (path === '/health' && method === 'GET') {
      return json({ success: true, status: 'ok', engine: 'NEXORUM OS', timestamp: new Date().toISOString() });
    }

    if (path === '/networks' && method === 'GET') {
      return json({ success: true, data: NEXORUMEngine.listNetworks() });
    }

    if (path === '/rpc/status' && method === 'GET') {
      return json({ success: true, data: await NEXORUMEngine.getRpcStatus() });
    }

    if (path === '/transactions/simulate' && method === 'POST') {
      const parsed = validateSimulateTx(await readJsonBody(request));
      if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);
      return json({ success: true, data: await NEXORUMEngine.simulateTransaction(parsed.value) });
    }

    if (path === '/tokens/create' && method === 'POST') {
      const parsed = validateTokenParams(await readJsonBody(request));
      if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);
      return json({ success: true, data: await NEXORUMEngine.createToken(parsed.value) });
    }

    const portfolioMatch = path.match(/^\/portfolio\/([^/]+)\/?$/);
    if (portfolioMatch && method === 'GET') {
      const address = decodeURIComponent(portfolioMatch[1]).trim();
      if (!address || address.length > 128) return json({ success: false, error: 'Invalid address' }, 400);
      const network = url.searchParams.get('network')?.trim().toLowerCase() || undefined;
      return json({ success: true, data: await NEXORUMEngine.getPortfolio(address, network) });
    }

    if (path === '/db/schema' && method === 'GET') {
      return new Response(getSchemaDDL(), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
      });
    }

    return json({ success: false, error: 'Not found' }, 404);
  } catch (err) {
    const apiErr = err instanceof ApiError ? err : null;
    if (!apiErr) console.error('[NEXORUM API] Unhandled error:', err);
    return json(
      { success: false, error: err instanceof Error ? err.message : 'Internal Server Error' },
      apiErr?.status ?? 500
    );
  }
}
