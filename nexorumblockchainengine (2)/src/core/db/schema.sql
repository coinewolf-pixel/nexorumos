-- NEXORUM OS — D1 (SQLite) schema
-- Applied via: npm run db:migrate (local) / npm run db:migrate:prod (remote)
-- Keep in sync with src/core/db/schema.ts (SCHEMA_DDL), which serves this
-- same DDL from GET /api/v1/db/schema.

CREATE TABLE IF NOT EXISTS networks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  symbol     TEXT NOT NULL,
  chain_id   INTEGER,
  rpc_url    TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  network_id    TEXT NOT NULL REFERENCES networks(id),
  tx_hash       TEXT NOT NULL,
  from_address  TEXT NOT NULL,
  to_address    TEXT,
  value         TEXT NOT NULL DEFAULT '0',
  status        TEXT NOT NULL DEFAULT 'simulated',
  gas_estimate  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_network ON transactions(network_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);

CREATE TABLE IF NOT EXISTS tokens (
  id                TEXT PRIMARY KEY,
  network_id        TEXT NOT NULL REFERENCES networks(id),
  name              TEXT NOT NULL,
  symbol            TEXT NOT NULL,
  total_supply      TEXT NOT NULL,
  decimals          INTEGER NOT NULL DEFAULT 18,
  owner_address     TEXT NOT NULL,
  contract_address  TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner_address);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  address      TEXT NOT NULL,
  network_id   TEXT NOT NULL REFERENCES networks(id),
  balance      TEXT NOT NULL,
  usd_value    REAL,
  snapshot_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_portfolio_address ON portfolio_snapshots(address);

INSERT OR IGNORE INTO networks (id, name, symbol, chain_id, rpc_url) VALUES
  ('ethereum', 'Ethereum', 'ETH', 1,    'https://cloudflare-eth.com'),
  ('solana',   'Solana',   'SOL', NULL, 'https://api.mainnet-beta.solana.com');
