PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS market (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL DEFAULT 'Rio Branco',
  state TEXT NOT NULL DEFAULT 'AC',
  api_key_hash TEXT UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  ean TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE(name, brand, unit)
);

CREATE TABLE IF NOT EXISTS price (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES market(id),
  product_id TEXT NOT NULL REFERENCES product(id),
  value_cents INTEGER NOT NULL CHECK (value_cents > 0),
  collected_at TEXT,
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  source TEXT NOT NULL CHECK (source IN ('painel', 'api', 'seed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (collected_at IS NULL OR collected_at GLOB '????-??-??')
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'merchant')),
  market_id TEXT REFERENCES market(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((role = 'merchant' AND market_id IS NOT NULL) OR role = 'consumer')
);

CREATE INDEX IF NOT EXISTS idx_price_product_collected ON price(product_id, collected_at);
CREATE INDEX IF NOT EXISTS idx_price_market_product ON price(market_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_category ON product(category);
