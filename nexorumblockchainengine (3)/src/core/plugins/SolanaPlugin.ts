import type {
  NetworkPlugin,
  NetworkDescriptor,
  SimulateTxParams,
  SimulateTxResult,
  TokenCreationParams,
  TokenCreationResult,
  PortfolioAssetBalance,
  RpcStatusResult,
} from '../types';
import { httpError } from '../utils/errors';
import { fakeTxHash, fakeBase58Address, seededBalance } from '../utils/simulate';

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PUBLIC_RPC_URL = 'https://api.mainnet-beta.solana.com';
const LAMPORTS_PER_SOL = 1_000_000_000;
const BASE_FEE_LAMPORTS = 5000;

export class SolanaPlugin implements NetworkPlugin {
  readonly id = 'solana';
  readonly name = 'Solana';
  readonly symbol = 'SOL';
  readonly chainId = null;

  private live = false;

  async init(): Promise<void> {
    try {
      await this.rpcCall('getSlot', [], 2500);
      this.live = true;
    } catch {
      this.live = false;
    }
  }

  describe(): NetworkDescriptor {
    return {
      id: this.id,
      name: this.name,
      symbol: this.symbol,
      chainId: null,
      status: 'operational',
      mode: this.live ? 'live' : 'simulated',
    };
  }

  isValidAddress(address: string): boolean {
    return typeof address === 'string' && SOLANA_ADDRESS_RE.test(address);
  }

  private async rpcCall(method: string, params: unknown[], timeoutMs = 4000): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(PUBLIC_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
      const payload: any = await res.json();
      if (payload.error) throw new Error(payload.error.message || 'RPC error');
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async pingRpc(): Promise<Omit<RpcStatusResult, 'network' | 'latencyMs'>> {
    try {
      const slot = await this.rpcCall('getSlot', []);
      this.live = true;
      return { ok: true, mode: 'live', blockHeight: slot };
    } catch {
      this.live = false;
      return {
        ok: true,
        mode: 'simulated',
        blockHeight: 250_000_000 + Math.floor(Date.now() / 400),
      };
    }
  }

  async simulateTransaction(params: SimulateTxParams): Promise<SimulateTxResult> {
    if (!this.isValidAddress(params.from)) throw httpError(400, 'Invalid "from" address for Solana');
    if (!this.isValidAddress(params.to)) throw httpError(400, 'Invalid "to" address for Solana');

    const value = Number(params.value);
    if (!Number.isFinite(value) || value < 0) {
      throw httpError(400, 'Invalid "value" — expected a decimal SOL amount, e.g. "1.5"');
    }

    return {
      network: this.id,
      from: params.from,
      to: params.to,
      value: params.value,
      estimatedGas: String(BASE_FEE_LAMPORTS),
      estimatedFeeNative: (BASE_FEE_LAMPORTS / LAMPORTS_PER_SOL).toFixed(8),
      mode: this.live ? 'live' : 'simulated',
      willSucceed: true,
      txHashPreview: fakeTxHash(params.from + params.to + params.value),
      timestamp: new Date().toISOString(),
    };
  }

  async createToken(params: TokenCreationParams): Promise<TokenCreationResult> {
    if (!this.isValidAddress(params.owner)) throw httpError(400, 'Invalid owner address for Solana');
    return {
      success: true,
      network: this.id,
      name: params.name,
      symbol: params.symbol,
      totalSupply: params.totalSupply,
      decimals: params.decimals,
      owner: params.owner,
      contractAddress: fakeBase58Address(params.owner + params.symbol),
      txHash: fakeTxHash(params.owner + params.name),
      mode: 'simulated',
      timestamp: new Date().toISOString(),
    };
  }

  async getPortfolio(address: string): Promise<PortfolioAssetBalance> {
    if (!this.isValidAddress(address)) throw httpError(400, 'Invalid Solana address');

    try {
      const result = await this.rpcCall('getBalance', [address]);
      const lamports = typeof result === 'object' && result !== null ? result.value : result;
      if (typeof lamports !== 'number') throw new Error('Unexpected RPC response');
      return {
        network: this.id,
        symbol: this.symbol,
        address,
        balance: String(lamports),
        balanceFormatted: (lamports / LAMPORTS_PER_SOL).toFixed(6),
        usdValue: null,
        mode: 'live',
      };
    } catch {
      const balanceFormatted = seededBalance(address, 300);
      return {
        network: this.id,
        symbol: this.symbol,
        address,
        balance: String(Math.round(Number(balanceFormatted) * LAMPORTS_PER_SOL)),
        balanceFormatted,
        usdValue: null,
        mode: 'simulated',
      };
    }
  }
}
