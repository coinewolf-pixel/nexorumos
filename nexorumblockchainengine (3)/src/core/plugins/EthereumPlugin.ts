import { ethers } from 'ethers';
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
import { fakeTxHash, fakeContractAddress, seededBalance } from '../utils/simulate';

const PUBLIC_RPC_URL = 'https://cloudflare-eth.com';
const DEFAULT_GAS_PRICE_GWEI = 20;

export class EthereumPlugin implements NetworkPlugin {
  readonly id = 'ethereum';
  readonly name = 'Ethereum';
  readonly symbol = 'ETH';
  readonly chainId = 1;

  private provider: ethers.JsonRpcProvider | null = null;
  private live = false;

  async init(): Promise<void> {
    // `process` doesn't exist in the Cloudflare Workers runtime unless the
    // `nodejs_compat` compatibility flag is set — guard the lookup so this
    // plugin degrades to the public RPC instead of throwing there.
    const rpcUrl = (typeof process !== 'undefined' && process.env?.ETHEREUM_RPC_URL) || PUBLIC_RPC_URL;
    // `staticNetwork` set to an actual Network (not just `true`) tells ethers
    // to assume this network WITHOUT ever calling eth_chainId to verify it.
    // Without this, an unreachable RPC sends ethers into an indefinite
    // "cannot start up; retry in 1s" loop (meant for local dev nodes that
    // are still booting), which never gives up on its own.
    this.provider = new ethers.JsonRpcProvider(rpcUrl, this.chainId, {
      staticNetwork: ethers.Network.from(this.chainId),
      batchMaxCount: 1,
    });
    try {
      await this.raceTimeout(this.provider.getBlockNumber(), 4000);
      this.live = true;
    } catch {
      // No network access (or bad endpoint) — engine falls back to simulated mode.
      this.live = false;
    }
  }

  private raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), ms)),
    ]);
  }

  describe(): NetworkDescriptor {
    return {
      id: this.id,
      name: this.name,
      symbol: this.symbol,
      chainId: this.chainId,
      status: 'operational',
      mode: this.live ? 'live' : 'simulated',
    };
  }

  isValidAddress(address: string): boolean {
    return typeof address === 'string' && ethers.isAddress(address);
  }

  async pingRpc(): Promise<Omit<RpcStatusResult, 'network' | 'latencyMs'>> {
    if (this.provider) {
      try {
        const [blockNumber, feeData] = await this.raceTimeout(
          Promise.all([this.provider.getBlockNumber(), this.provider.getFeeData()]),
          4000
        );
        this.live = true;
        return {
          ok: true,
          mode: 'live',
          blockHeight: blockNumber,
          gasPriceGwei: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : undefined,
        };
      } catch (err) {
        this.live = false;
      }
    }
    return {
      ok: true,
      mode: 'simulated',
      blockHeight: 18_000_000 + Math.floor(Date.now() / 12_000),
      gasPriceGwei: (DEFAULT_GAS_PRICE_GWEI + Math.random() * 10).toFixed(2),
    };
  }

  async simulateTransaction(params: SimulateTxParams): Promise<SimulateTxResult> {
    if (!this.isValidAddress(params.from)) throw httpError(400, 'Invalid "from" address for Ethereum');
    if (!this.isValidAddress(params.to)) throw httpError(400, 'Invalid "to" address for Ethereum');

    let valueWei: bigint;
    try {
      valueWei = ethers.parseEther(params.value || '0');
    } catch {
      throw httpError(400, 'Invalid "value" — expected a decimal ETH amount, e.g. "0.5"');
    }
    if (valueWei < 0n) throw httpError(400, '"value" must be non-negative');

    let estimatedGas = params.data ? 65_000n : 21_000n;
    let mode: 'live' | 'simulated' = 'simulated';

    if (this.provider && this.live) {
      try {
        estimatedGas = await this.raceTimeout(this.provider.estimateGas({
          from: params.from,
          to: params.to,
          value: valueWei,
          data: (params.data as `0x${string}` | undefined) ?? undefined,
        }), 4000);
        mode = 'live';
      } catch {
        // Keep the heuristic estimate above.
      }
    }

    const feeEth = (Number(estimatedGas) * DEFAULT_GAS_PRICE_GWEI) / 1e9;

    return {
      network: this.id,
      from: params.from,
      to: params.to,
      value: params.value,
      estimatedGas: estimatedGas.toString(),
      estimatedFeeNative: feeEth.toFixed(8),
      mode,
      willSucceed: true,
      txHashPreview: fakeTxHash(params.from + params.to + params.value),
      timestamp: new Date().toISOString(),
    };
  }

  async createToken(params: TokenCreationParams): Promise<TokenCreationResult> {
    if (!this.isValidAddress(params.owner)) throw httpError(400, 'Invalid owner address for Ethereum');
    return {
      success: true,
      network: this.id,
      name: params.name,
      symbol: params.symbol,
      totalSupply: params.totalSupply,
      decimals: params.decimals,
      owner: params.owner,
      contractAddress: fakeContractAddress(params.owner + params.symbol),
      txHash: fakeTxHash(params.owner + params.name),
      mode: 'simulated',
      timestamp: new Date().toISOString(),
    };
  }

  async getPortfolio(address: string): Promise<PortfolioAssetBalance> {
    if (!this.isValidAddress(address)) throw httpError(400, 'Invalid Ethereum address');

    if (this.provider && this.live) {
      try {
        const balanceWei = await this.raceTimeout(this.provider.getBalance(address), 4000);
        return {
          network: this.id,
          symbol: this.symbol,
          address,
          balance: balanceWei.toString(),
          balanceFormatted: ethers.formatEther(balanceWei),
          usdValue: null,
          mode: 'live',
        };
      } catch {
        // fall through to simulated
      }
    }

    const balanceFormatted = seededBalance(address, 12);
    return {
      network: this.id,
      symbol: this.symbol,
      address,
      balance: ethers.parseEther(balanceFormatted).toString(),
      balanceFormatted,
      usdValue: null,
      mode: 'simulated',
    };
  }
}
