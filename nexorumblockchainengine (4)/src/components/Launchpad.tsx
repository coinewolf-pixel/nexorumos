import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ethers } from 'ethers';
import { Rocket, Wallet, Loader2, ExternalLink, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import tokenArtifact from '../core/contracts/NexorumToken.json';
import {
  connectWallet,
  onWalletChange,
  hasInjectedWallet,
  explorerTxUrl,
  explorerAddressUrl,
  explorerName,
  shortenAddress,
} from '../lib/wallet';
import {
  connectSolanaWallet,
  onSolanaWalletChange,
  hasPhantom,
  solanaExplorerUrl,
  SOLANA_CLUSTERS,
  type SolanaCluster,
} from '../lib/solanaWallet';
import { deploySolanaToken } from '../lib/deploySolanaToken';

/** Ethereum chain IDs where a deploy spends real money. */
const KNOWN_MAINNETS = new Set([1, 137, 8453, 42161, 10]);
const KNOWN_TESTNETS = new Set([11155111, 84532]);

type DeployResult =
  | { kind: 'ethereum'; contractAddress: string; txHash: string; chainId: number }
  | { kind: 'solana'; mintAddress: string; signature: string; cluster: SolanaCluster };

export default function Launchpad() {
  const [form, setForm] = useState({ name: '', symbol: '', supply: '', decimals: '18', network: 'Ethereum' });
  const [cluster, setCluster] = useState<SolanaCluster>('devnet');
  const [ethWallet, setEthWallet] = useState<{ address: string; chainId: number } | null>(null);
  const [solWallet, setSolWallet] = useState<{ address: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEthereum = form.network === 'Ethereum';

  useEffect(() => onWalletChange(() => setEthWallet(null)), []);
  useEffect(() => onSolanaWalletChange(() => setSolWallet(null)), []);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      if (isEthereum) {
        const { address, chainId } = await connectWallet();
        setEthWallet({ address, chainId });
      } else {
        const { publicKey } = await connectSolanaWallet();
        setSolWallet({ address: publicKey.toBase58() });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
    setConnecting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const decimalsNum = parseInt(form.decimals, 10) || 0;

    if (isEthereum) {
      if (!ethWallet) {
        setError('Connect your wallet first — the deploy transaction is signed on your device, we never see your key.');
        return;
      }
      setDeploying(true);
      try {
        const { signer, address, chainId } = await connectWallet();
        const factory = new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, signer);
        const initialSupply = ethers.parseUnits(form.supply || '0', decimalsNum);
        const contract = await factory.deploy(form.name, form.symbol, decimalsNum, initialSupply, address);
        const deployTx = contract.deploymentTransaction();
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        setResult({ kind: 'ethereum', contractAddress, txHash: deployTx?.hash ?? '', chainId });
      } catch (err: any) {
        setError(err?.shortMessage || err?.reason || err?.message || 'Deployment failed or was rejected in your wallet');
      }
      setDeploying(false);
      return;
    }

    // Solana
    if (!solWallet) {
      setError('Connect Phantom first — the deploy transaction is signed on your device, we never see your key.');
      return;
    }
    setDeploying(true);
    try {
      const { publicKey, provider } = await connectSolanaWallet();
      const { mintAddress, signature } = await deploySolanaToken({
        rpcUrl: SOLANA_CLUSTERS[cluster].rpcUrl,
        payerPublicKey: publicKey,
        provider,
        name: form.name,
        symbol: form.symbol,
        decimals: decimalsNum,
        supply: form.supply,
      });
      setResult({ kind: 'solana', mintAddress, signature, cluster });
    } catch (err: any) {
      setError(err?.message || 'Deployment failed or was rejected in your wallet');
    }
    setDeploying(false);
  };

  const walletReady = isEthereum ? !!ethWallet : !!solWallet;
  const isRiskyNetwork = isEthereum ? !!ethWallet && KNOWN_MAINNETS.has(ethWallet.chainId) : cluster === 'mainnet-beta';

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-1">Token Launchpad</h2>
        <p className="text-sm text-slate-400 mb-6">
          Deploy real ERC-20 / SPL tokens, signed directly from your own wallet — we never see your private key.
        </p>

        {/* Wallet connection panel */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {isEthereum ? (
            ethWallet ? (
              <>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2 size={16} className="text-nexorum-success" />
                  Connected: <span className="font-mono text-white">{shortenAddress(ethWallet.address)}</span>
                  <span className="text-slate-500">
                    · chain {ethWallet.chainId}
                    {explorerName(ethWallet.chainId) ? ` (${explorerName(ethWallet.chainId)})` : ''}
                  </span>
                </div>
                <button type="button" onClick={handleConnect} className="text-xs font-medium text-nexorum-accent hover:underline">
                  Switch account
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">Connect the wallet that will sign the deploy transaction.</p>
                <ConnectButton connecting={connecting} onClick={handleConnect} hasWallet={hasInjectedWallet()} label="MetaMask" />
              </>
            )
          ) : solWallet ? (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 size={16} className="text-nexorum-success" />
                Connected: <span className="font-mono text-white">{shortenAddress(solWallet.address)}</span>
              </div>
              <button type="button" onClick={handleConnect} className="text-xs font-medium text-nexorum-accent hover:underline">
                Switch account
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">Connect the wallet that will sign the deploy transaction.</p>
              <ConnectButton connecting={connecting} onClick={handleConnect} hasWallet={hasPhantom()} label="Phantom" />
            </>
          )}
        </div>

        {isRiskyNetwork && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-nexorum-danger/30 bg-nexorum-danger/10 p-4 text-sm text-nexorum-danger">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              You're deploying to a <strong>real network</strong> — this costs real{' '}
              {isEthereum ? 'ETH/gas' : 'SOL'} from your wallet and, once confirmed, <strong>cannot be undone or deleted</strong>.
            </span>
          </div>
        )}
        {!isEthereum && !isRiskyNetwork && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-nexorum-warning" />
            Devnet uses free test SOL — nothing here has real value. Switch to Mainnet Beta below only when you mean it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Token Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-nexorum-accent focus:outline-none"
                placeholder="MyToken"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Symbol</label>
              <input
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-nexorum-accent focus:outline-none"
                placeholder="MTK"
                maxLength={11}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Total Supply</label>
              <input
                value={form.supply}
                onChange={(e) => setForm({ ...form, supply: e.target.value })}
                className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-nexorum-accent focus:outline-none"
                placeholder="1000000"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Decimals</label>
              <input
                value={form.decimals}
                onChange={(e) => setForm({ ...form, decimals: e.target.value })}
                type="number"
                min={0}
                max={18}
                className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-nexorum-accent focus:outline-none"
                placeholder="18"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Network</label>
              <select
                value={form.network}
                onChange={(e) => {
                  setForm({ ...form, network: e.target.value });
                  setResult(null);
                  setError(null);
                }}
                className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white focus:border-nexorum-accent focus:outline-none"
              >
                <option>Ethereum</option>
                <option>Solana</option>
              </select>
            </div>
            {!isEthereum && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cluster</label>
                <select
                  value={cluster}
                  onChange={(e) => {
                    setCluster(e.target.value as SolanaCluster);
                    setResult(null);
                    setError(null);
                  }}
                  className="w-full rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white focus:border-nexorum-accent focus:outline-none"
                >
                  {Object.entries(SOLANA_CLUSTERS).map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={deploying || !walletReady}
            className="flex items-center justify-center gap-2 rounded-lg bg-nexorum-accent/10 border border-nexorum-accent/30 px-4 py-2.5 text-sm font-semibold text-nexorum-accent hover:bg-nexorum-accent/20 transition-all disabled:opacity-50"
          >
            {deploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            {deploying ? 'Deploying…' : 'Deploy Token (on-chain)'}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-xl border border-nexorum-danger/20 bg-nexorum-danger/10 p-4 text-sm text-nexorum-danger">
            {error}
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl bg-nexorum-success/10 border border-nexorum-success/20 p-4"
          >
            <p className="text-sm font-medium text-nexorum-success mb-3">
              Token deployed on-chain — signed by your wallet, not our server.
            </p>
            {result.kind === 'ethereum' ? (
              <ResultRow
                items={[
                  { label: 'Contract', value: result.contractAddress, url: explorerAddressUrl(result.chainId, result.contractAddress) },
                  { label: 'Tx hash', value: result.txHash, url: explorerTxUrl(result.chainId, result.txHash) },
                ]}
              />
            ) : (
              <ResultRow
                items={[
                  { label: 'Mint', value: result.mintAddress, url: solanaExplorerUrl(result.cluster, 'address', result.mintAddress) },
                  { label: 'Signature', value: result.signature, url: solanaExplorerUrl(result.cluster, 'tx', result.signature) },
                ]}
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ConnectButton({
  connecting,
  onClick,
  hasWallet,
  label,
}: {
  connecting: boolean;
  onClick: () => void;
  hasWallet: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={connecting}
      className="flex items-center gap-2 rounded-lg bg-nexorum-accent/10 border border-nexorum-accent/30 px-3 py-2 text-sm font-semibold text-nexorum-accent hover:bg-nexorum-accent/20 transition-all disabled:opacity-50"
    >
      {connecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
      {connecting ? 'Connecting…' : hasWallet ? `Connect ${label}` : `Install ${label}`}
    </button>
  );
}

function ResultRow({ items }: { items: { label: string; value: string; url: string | null }[] }) {
  return (
    <dl className="space-y-2 text-xs font-mono text-slate-300">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <dt className="text-slate-500 w-28 shrink-0">{item.label}</dt>
          <dd className="truncate">{item.value}</dd>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-nexorum-accent hover:underline shrink-0">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ))}
    </dl>
  );
}
