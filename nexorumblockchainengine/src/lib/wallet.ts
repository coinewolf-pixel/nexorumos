/**
 * Thin wrapper around an injected EIP-1193 wallet (MetaMask etc.) for
 * client-side transaction signing. The private key never leaves the
 * user's wallet / device — this module only ever talks to `window.ethereum`,
 * never sends a key anywhere, and the server never sees one either.
 */
import { ethers } from 'ethers';

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

function getEthereum(): EthereumProvider {
  if (!window.ethereum) {
    throw new Error('No injected wallet found — install MetaMask (or another EIP-1193 wallet) to deploy tokens.');
  }
  return window.ethereum;
}

export interface ConnectedWallet {
  signer: ethers.JsonRpcSigner;
  address: string;
  chainId: number;
}

/** Requests account access and returns a fresh signer bound to the current account/network. */
export async function connectWallet(): Promise<ConnectedWallet> {
  const eth = getEthereum();
  const provider = new ethers.BrowserProvider(eth);
  const accounts = (await provider.send('eth_requestAccounts', [])) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet connection was rejected or no account is available.');
  }
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return { signer, address: accounts[0], chainId: Number(network.chainId) };
}

/** Fires `cb` when the connected account or chain changes; returns an unsubscribe function. */
export function onWalletChange(cb: () => void): () => void {
  if (!hasInjectedWallet()) return () => {};
  const eth = getEthereum();
  eth.on?.('accountsChanged', cb);
  eth.on?.('chainChanged', cb);
  return () => {
    eth.removeListener?.('accountsChanged', cb);
    eth.removeListener?.('chainChanged', cb);
  };
}

const EXPLORERS: Record<number, { name: string; base: string }> = {
  1: { name: 'Etherscan', base: 'https://etherscan.io' },
  11155111: { name: 'Sepolia Etherscan', base: 'https://sepolia.etherscan.io' },
  137: { name: 'Polygonscan', base: 'https://polygonscan.com' },
  8453: { name: 'Basescan', base: 'https://basescan.org' },
  84532: { name: 'Base Sepolia Basescan', base: 'https://sepolia.basescan.org' },
  42161: { name: 'Arbiscan', base: 'https://arbiscan.io' },
  10: { name: 'Optimistic Etherscan', base: 'https://optimistic.etherscan.io' },
};

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const explorer = EXPLORERS[chainId];
  return explorer ? `${explorer.base}/tx/${txHash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const explorer = EXPLORERS[chainId];
  return explorer ? `${explorer.base}/address/${address}` : null;
}

export function explorerName(chainId: number): string | null {
  return EXPLORERS[chainId]?.name ?? null;
}

export function shortenAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
