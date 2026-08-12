import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Blocks, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface NetworkDescriptor {
  id: string;
  name: string;
  symbol: string;
  chainId: number | null;
  status: string;
  mode: 'live' | 'simulated';
}

interface RpcStatus {
  network: string;
  ok: boolean;
  mode: 'live' | 'simulated';
  blockHeight?: number | string;
  gasPriceGwei?: string;
  latencyMs: number;
  error?: string;
}

export default function NetworkCard() {
  const [networks, setNetworks] = useState<NetworkDescriptor[]>([]);
  const [rpcStatus, setRpcStatus] = useState<Record<string, RpcStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [networksRes, rpcRes]: [any, any] = await Promise.all([
        fetch('/api/v1/networks').then((r) => r.json()),
        fetch('/api/v1/rpc/status').then((r) => r.json()),
      ]);
      if (!networksRes.success) throw new Error(networksRes.error || 'Failed to load networks');
      setNetworks(networksRes.data);
      if (rpcRes.success) {
        const map: Record<string, RpcStatus> = {};
        for (const status of rpcRes.data as RpcStatus[]) map[status.network] = status;
        setRpcStatus(map);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load networks');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Networks</h2>
          <p className="text-sm text-slate-400">Chains registered with the blockchain plugin engine</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-nexorum-800 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-nexorum-danger/20 bg-nexorum-danger/10 p-4 text-sm text-nexorum-danger">
          {error}
        </div>
      )}

      {loading && networks.length === 0 ? (
        <p className="text-sm text-slate-500">Loading networks…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {networks.map((network) => {
            const status = rpcStatus[network.id];
            return (
              <motion.div
                key={network.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-2xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexorum-accent/10 text-nexorum-accent">
                      <Blocks size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{network.name}</h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {network.symbol} {network.chainId ? `· chain ${network.chainId}` : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      network.mode === 'live'
                        ? 'bg-nexorum-success/10 text-nexorum-success'
                        : 'bg-nexorum-warning/10 text-nexorum-warning'
                    }`}
                  >
                    {network.mode}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-4 text-xs">
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="mt-1 flex items-center gap-1 font-medium text-white">
                      {status?.ok ? (
                        <CheckCircle2 size={12} className="text-nexorum-success" />
                      ) : (
                        <XCircle size={12} className="text-nexorum-danger" />
                      )}
                      {status?.ok ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Block</p>
                    <p className="mt-1 font-mono font-medium text-white">{status?.blockHeight ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Latency</p>
                    <p className="mt-1 font-mono font-medium text-white">
                      {status ? `${status.latencyMs} ms` : '—'}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
