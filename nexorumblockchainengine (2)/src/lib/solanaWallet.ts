/**
 * Thin wrapper around Phantom's injected Solana provider for client-side
 * transaction signing. As with the Ethereum wallet lib, the private key
 * never leaves the wallet — this only ever talks to `window.phantom.solana`.
 */
import { PublicKey } from '@solana/web3.js';

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  /** Signs only — we submit via our own connection so it lands on the cluster the UI says it will, regardless of which network Phantom itself is set to. */
  signTransaction: <T>(transaction: T) => Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    /** Legacy injection point some older Phantom versions also set. */
    solana?: PhantomProvider;
  }
}

export function hasPhantom(): boolean {
  return typeof window !== 'undefined' && !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
}

function getProvider(): PhantomProvider {
  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not found — install Phantom to deploy SPL tokens.');
  }
  return provider;
}

export interface ConnectedSolanaWallet {
  publicKey: PublicKey;
  provider: PhantomProvider;
}

export async function connectSolanaWallet(): Promise<ConnectedSolanaWallet> {
  const provider = getProvider();
  const resp = await provider.connect();
  return { publicKey: new PublicKey(resp.publicKey.toString()), provider };
}

export function onSolanaWalletChange(cb: () => void): () => void {
  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) return () => {};
  provider.on?.('accountChanged', cb);
  provider.on?.('disconnect', cb);
  return () => {
    provider.off?.('accountChanged', cb);
    provider.off?.('disconnect', cb);
  };
}

export type SolanaCluster = 'devnet' | 'mainnet-beta';

export const SOLANA_CLUSTERS: Record<SolanaCluster, { label: string; rpcUrl: string; risky: boolean }> = {
  devnet: { label: 'Devnet (test SOL — safe)', rpcUrl: 'https://api.devnet.solana.com', risky: false },
  'mainnet-beta': { label: 'Mainnet Beta (real SOL!)', rpcUrl: 'https://api.mainnet-beta.solana.com', risky: true },
};

export function solanaExplorerUrl(cluster: SolanaCluster, kind: 'tx' | 'address', value: string): string {
  const suffix = cluster === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/${kind}/${value}${suffix}`;
}
