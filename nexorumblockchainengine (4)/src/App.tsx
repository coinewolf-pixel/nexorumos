import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Blocks, Activity, Wallet, Rocket, Menu, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import NetworkCard from './components/NetworkCard';
import Portfolio from './components/Portfolio';
import Launchpad from './components/Launchpad';

type Tab = 'dashboard' | 'networks' | 'portfolio' | 'launchpad';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} /> },
    { id: 'networks', label: 'Networks', icon: <Blocks size={18} /> },
    { id: 'portfolio', label: 'Portfolio', icon: <Wallet size={18} /> },
    { id: 'launchpad', label: 'Launchpad', icon: <Rocket size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-nexorum-900 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-nexorum-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-nexorum-accent/10 text-nexorum-accent">
              <Blocks size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white glow-text">NEXORUM OS</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Blockchain Engine</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-nexorum-accent/10 text-nexorum-accent'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            className="md:hidden text-slate-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5 md:hidden"
            >
              <div className="flex flex-col gap-1 p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'bg-nexorum-accent/10 text-nexorum-accent'
                        : 'text-slate-400'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'networks' && <NetworkCard />}
            {activeTab === 'portfolio' && <Portfolio />}
            {activeTab === 'launchpad' && <Launchpad />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
