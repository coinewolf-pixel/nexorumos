import type {
  NetworkPlugin,
  NetworkDescriptor,
  RpcStatusResult,
  SimulateTxParams,
  SimulateTxResult,
  TokenCreationParams,
  TokenCreationResult,
  PortfolioResult,
  PortfolioAssetBalance,
} from '../types';
import { ApiError } from '../utils/errors';
import { EthereumPlugin } from '../plugins/EthereumPlugin';
import { SolanaPlugin } from '../plugins/SolanaPlugin';

/**
 * NEXORUM Blockchain Engine
 *
 * Modular plugin registry — each supported network implements the
 * `NetworkPlugin` interface. Adding a new chain means dropping a plugin
 * in `src/core/plugins` and registering it in `_boot()` below.
 */
class BlockchainManager {
  private plugins = new Map<string, NetworkPlugin>();
  private booted = false;
  private bootPromise: Promise<void> | null = null;

  async bootEngine(): Promise<void> {
    if (this.booted) return;
    if (!this.bootPromise) {
      this.bootPromise = this._boot();
    }
    await this.bootPromise;
  }

  private async _boot(): Promise<void> {
    this.registerPlugin(new EthereumPlugin());
    this.registerPlugin(new SolanaPlugin());

    await Promise.all(
      Array.from(this.plugins.values()).map(async (plugin) => {
        try {
          await plugin.init?.();
        } catch (err: any) {
          console.warn(`[NEXORUM] Plugin "${plugin.id}" failed to initialize (falling back to simulated mode):`, err?.message ?? err);
        }
      })
    );

    this.booted = true;
  }

  registerPlugin(plugin: NetworkPlugin): void {
    this.plugins.set(plugin.id.toLowerCase(), plugin);
  }

  private getPlugin(networkId: string | undefined | null): NetworkPlugin | undefined {
    if (!networkId) return undefined;
    return this.plugins.get(networkId.toLowerCase().trim());
  }

  listNetworks(): NetworkDescriptor[] {
    return Array.from(this.plugins.values()).map((plugin) => plugin.describe());
  }

  async getRpcStatus(): Promise<RpcStatusResult[]> {
    return Promise.all(
      Array.from(this.plugins.values()).map(async (plugin) => {
        const start = Date.now();
        try {
          const status = await plugin.pingRpc();
          return { network: plugin.id, latencyMs: Date.now() - start, ...status };
        } catch (err: any) {
          return {
            network: plugin.id,
            ok: false,
            mode: 'simulated' as const,
            latencyMs: Date.now() - start,
            error: err?.message ?? 'RPC ping failed',
          };
        }
      })
    );
  }

  async simulateTransaction(params: SimulateTxParams): Promise<SimulateTxResult> {
    const plugin = this.getPlugin(params.network);
    if (!plugin) throw new ApiError(400, `Unsupported network: "${params.network}". Supported: ${this.supportedNetworkIds().join(', ')}`);
    return plugin.simulateTransaction(params);
  }

  async createToken(params: TokenCreationParams): Promise<TokenCreationResult> {
    const plugin = this.getPlugin(params.network);
    if (!plugin) throw new ApiError(400, `Unsupported network: "${params.network}". Supported: ${this.supportedNetworkIds().join(', ')}`);
    return plugin.createToken(params);
  }

  async getPortfolio(address: string, network?: string): Promise<PortfolioResult> {
    if (network) {
      const plugin = this.getPlugin(network);
      if (!plugin) throw new ApiError(400, `Unsupported network: "${network}". Supported: ${this.supportedNetworkIds().join(', ')}`);
      const balance = await plugin.getPortfolio(address);
      return { address, balances: [balance] };
    }

    const settled = await Promise.all(
      Array.from(this.plugins.values()).map(async (plugin): Promise<PortfolioAssetBalance | null> => {
        try {
          return await plugin.getPortfolio(address);
        } catch {
          // Address format doesn't match this network — skip it silently
          // when scanning across all networks.
          return null;
        }
      })
    );

    const balances = settled.filter((b): b is PortfolioAssetBalance => b !== null);
    if (balances.length === 0) {
      throw new ApiError(400, 'Address does not match any supported network format');
    }
    return { address, balances };
  }

  supportedNetworkIds(): string[] {
    return Array.from(this.plugins.keys());
  }
}

export const NEXORUMEngine = new BlockchainManager();
