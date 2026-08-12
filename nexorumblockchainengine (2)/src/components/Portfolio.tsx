import { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, Search, Loader2 } from 'lucide-react';

interface PortfolioBalance {
  network: string;
  symbol: string;
  address: string;
  balance: string;
  balanceFormatted: string;
  usdValue: number | null;
  mode: 'live' | 'simulated';
}

const SAMPLE_ADDRESSES: Record<string, string> = {
  All: '',
  Ethereum: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  Solana: '4Nd1mYPu8kV4ZWCz8vJqzZQrJqZgqZoTZuG9K1XwZjuZ',
};

export default function Portfolio() {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'All' | 'Ethereum' | 'Solana'>('All');
  const [balances, setBalances] = useState<PortfolioBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = network !== 'All' ? `?network=${network.toLowerCase()}` : '';
      const res = await fetch(`/api/v1/portfolio/${encodeURIComponent(address.trim())}${params}`);
      const data: any = await res.json();
      if (!data.success) {
        setBalances([]);
        setError(data.error || 'Failed to load portfolio');
      } else {
        setBalances(data.data.balances);
      }
    } catch {
      setBalances([]);
      setError('Network error while fetching portfolio');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-1">Portfolio Aggregator</h2>
        <p className="text-sm text-slate-400 mb-6">Look up balances for any wallet address across supported chains</p>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value as typeof network)}
            className="rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white focus:border-nexorum-accent focus:outline-none sm:w-40"
          >
            <option>All</option>
            <option>Ethereum</option>
            <option>Solana</option>
          </select>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={SAMPLE_ADDRESSES[network] ? `e.g. ${SAMPLE_ADDRESSES[network]}` : 'Wallet address'}
            className="flex-1 rounded-lg bg-nexorum-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-nexorum-accent focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-nexorum-accent/10 border border-nexorum-accent/30 px-4 py-2.5 text-sm font-semibold text-nexorum-accent hover:bg-nexorum-accent/20 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-nexorum-danger/20 bg-nexorum-danger/10 p-4 text-sm text-nexorum-danger">
          {error}
        </div>
      )}

      {searched && !error && !loading && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Balances for <span className="font-mono text-slate-300">{address}</span>
          </h3>
          {balances.length === 0 ? (
            <p className="text-sm text-slate-500">No balances found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {balances.map((b) => (
                <motion.div
                  key={b.network}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nexorum-accent/10 text-nexorum-accent">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize text-white">{b.network}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          b.mode === 'live'
                            ? 'bg-nexorum-success/10 text-nexorum-success'
                            : 'bg-nexorum-warning/10 text-nexorum-warning'
                        }`}
                      >
                        {b.mode}
                      </span>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-semibold text-white">
                    {b.balanceFormatted} {b.symbol}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
