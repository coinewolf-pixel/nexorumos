/**
 * NEXORUM OS — Shared blockchain-engine types
 */

export type EngineMode = 'live' | 'simulated';

export interface NetworkDescriptor {
  id: string;
  name: string;
  symbol: string;
  chainId: number | null;
  status: 'operational' | 'degraded' | 'offline';
  mode: EngineMode;
}

export interface RpcStatusResult {
  network: string;
  ok: boolean;
  mode: EngineMode;
  blockHeight?: number | string;
  gasPriceGwei?: string;
  latencyMs: number;
  error?: string;
}

export interface SimulateTxParams {
  network: string;
  from: string;
  to: string;
  value: string;
  data?: string;
}

export interface SimulateTxResult {
  network: string;
  from: string;
  to: string;
  value: string;
  estimatedGas: string;
  estimatedFeeNative: string;
  mode: EngineMode;
  willSucceed: boolean;
  txHashPreview: string;
  timestamp: string;
}

export interface TokenCreationParams {
  network: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  owner: string;
}

export interface TokenCreationResult {
  success: true;
  network: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  owner: string;
  contractAddress: string;
  txHash: string;
  mode: EngineMode;
  timestamp: string;
}

export interface PortfolioAssetBalance {
  network: string;
  symbol: string;
  address: string;
  balance: string;
  balanceFormatted: string;
  usdValue: number | null;
  mode: EngineMode;
}

export interface PortfolioResult {
  address: string;
  balances: PortfolioAssetBalance[];
}

export interface NetworkPlugin {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly chainId: number | null;
  init?(): Promise<void>;
  describe(): NetworkDescriptor;
  isValidAddress(address: string): boolean;
  pingRpc(): Promise<Omit<RpcStatusResult, 'network' | 'latencyMs'>>;
  simulateTransaction(params: SimulateTxParams): Promise<SimulateTxResult>;
  createToken(params: TokenCreationParams): Promise<TokenCreationResult>;
  getPortfolio(address: string): Promise<PortfolioAssetBalance>;
}
