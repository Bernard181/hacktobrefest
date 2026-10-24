-- ============================================================
-- Comparador de Precos — Rio Branco/AC
-- Schema SQLite do MVP (REQUISITOS.md, secao 7)
-- Dinheiro SEMPRE em centavos (INTEGER) — RN09.
-- Datas em texto ISO 8601: data_coleta = 'YYYY-MM-DD',
-- created_at = 'YYYY-MM-DDTHH:MM:SSZ'.
-- Contrato congelado: mudanca aqui exige atualizar docs/api.md.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- market ----------
CREATE TABLE IF NOT EXISTS market (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  endereco      TEXT    NOT NULL,
  bairro        TEXT    NOT NULL,
  cidade        TEXT    NOT NULL DEFAULT 'Rio Branco/AC',
  -- RN08: apenas o hash SHA-256 da API key; nunca o valor em texto puro.
  api_key_hash  TEXT,
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_market_cidade ON market (cidade);

-- ---------- product ----------
CREATE TABLE IF NOT EXISTS product (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  categoria TEXT    NOT NULL,
  -- RN10: unidade faz parte do produto. '5 kg' e '1 kg' sao ofertas distintas.
  unidade   TEXT    NOT NULL,
  ean       TEXT,
  ativo     INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_product_categoria ON product (categoria);

-- ---------- price (append-only — RN06) ----------
CREATE TABLE IF NOT EXISTS price (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  market_id      INTEGER NOT NULL REFERENCES market (id),
  product_id     INTEGER NOT NULL REFERENCES product (id),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  data_coleta    TEXT    NOT NULL
                 CHECK (data_coleta GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  fonte          TEXT    NOT NULL CHECK (fonte IN ('painel', 'api')),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_price_product_data ON price (product_id, data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_price_market ON price (market_id);

-- RN06: atualizar preco = INSERT de novo registro. Alterar/apagar e proibido.
CREATE TRIGGER IF NOT EXISTS price_block_update
BEFORE UPDATE ON price
BEGIN
  SELECT RAISE(ABORT, 'price e append-only: insira um novo registro (RN06)');
END;

CREATE TRIGGER IF NOT EXISTS price_block_delete
BEFORE DELETE ON price
BEGIN
  SELECT RAISE(ABORT, 'price e append-only: registros nao podem ser removidos (RN06)');
END;

-- ---------- user ----------
CREATE TABLE IF NOT EXISTS user (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  senha_hash TEXT    NOT NULL,
  role       TEXT    NOT NULL CHECK (role IN ('consumidor', 'lojista')),
  -- RN07: lojista sempre vinculado a um mercado; consumidor nunca.
  market_id  INTEGER REFERENCES market (id),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (role <> 'lojista' OR market_id IS NOT NULL),
  CHECK (role <> 'consumidor' OR market_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_market ON user (market_id);
