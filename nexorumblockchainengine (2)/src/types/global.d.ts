/**
 * Minimal EIP-1193 injected-provider typing (MetaMask, and compatible
 * wallets) — just enough surface for src/lib/wallet.ts. Not a full spec.
 */
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
