import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Blocks, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

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

export default function Dashboard() {
  const [networks, setNetworks] = useState<NetworkDescriptor[]>([]);
  const [rpcStatus, setRpcStatus] = useState<RpcStatus[]>([]);
  const [health, setHealth] = useState<'checking' | 'ok' | 'down'>('checking');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJson = async (url: string): Promise<any | null> => {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch {
      return null;
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [healthRes, networksRes, rpcRes] = await Promise.all([
        fetchJson('/api/v1/health'),
        fetchJson('/api/v1/networks'),
        fetchJson('/api/v1/rpc/status'),
      ]);
      setHealth(healthRes?.success ? 'ok' : 'down');
      setNetworks(networksRes?.success ? networksRes.data : []);
      setRpcStatus(rpcRes?.success ? rpcRes.data : []);
      setLastUpdated(new Date());
    } catch {
      setHealth('down');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const liveCount = networks.filter((n) => n.mode === 'live').length;
  const avgLatency =
    rpcStatus.length > 0
      ? Math.round(rpcStatus.reduce((sum, r) => sum + r.latencyMs, 0) / rpcStatus.length)
      : null;

  const stats = [
    {
      label: 'Engine Status',
      value: health === 'ok' ? 'Operational' : health === 'checking' ? 'Checking…' : 'Unreachable',
      icon: health === 'ok' ? ShieldCheck : AlertTriangle,
      tone: health === 'ok' ? 'text-nexorum-success' : health === 'checking' ? 'text-slate-400' : 'text-nexorum-danger',
    },
    {
      label: 'Networks Registered',
      value: String(networks.length),
      icon: Blocks,
      tone: 'text-nexorum-accent',
    },
    {
      label: 'Live RPC Connections',
      value: `${liveCount} / ${networks.length || 0}`,
      icon: Zap,
      tone: liveCount > 0 ? 'text-nexorum-success' : 'text-nexorum-warning',
    },
    {
      label: 'Avg. RPC Latency',
      value: avgLatency !== null ? `${avgLatency} ms` : '—',
      icon: Activity,
      tone: 'text-slate-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">System Overview</h2>
          <p className="text-sm text-slate-400">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading engine telemetry…'}
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-nexorum-800 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-4"
          >
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${stat.tone}`}>
              <stat.icon size={16} />
            </div>
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">RPC Benchmark</h3>
        {rpcStatus.length === 0 ? (
          <p className="text-sm text-slate-500">{loading ? 'Pinging networks…' : 'No RPC data available.'}</p>
        ) : (
          <div className="space-y-2">
            {rpcStatus.map((status) => (
              <div
                key={status.network}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${status.ok ? 'bg-nexorum-success animate-pulse-glow' : 'bg-nexorum-danger'}`}
                  />
                  <span className="text-sm font-medium capitalize text-white">{status.network}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      status.mode === 'live'
                        ? 'bg-nexorum-success/10 text-nexorum-success'
                        : 'bg-nexorum-warning/10 text-nexorum-warning'
                    }`}
                  >
                    {status.mode}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                  {status.blockHeight !== undefined && <span>block {status.blockHeight}</span>}
                  {status.gasPriceGwei && <span>{Number(status.gasPriceGwei).toFixed(2)} gwei</span>}
                  <span>{status.latencyMs} ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
