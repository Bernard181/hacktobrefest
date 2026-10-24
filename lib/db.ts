import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { rankPrices } from './prices'

export type Product = { id: string; name: string; brand: string; category: string; unit: string }
export type Market = { id: string; name: string; address: string | null; neighborhood: string | null; city: string; state: string; demo: boolean }

export function productRow(row: any): Product {
  return { id: row.id, name: row.name, brand: row.brand, category: row.category, unit: row.unit }
}

export function marketRow(row: any): Market {
  return { id: row.id, name: row.name, address: row.address, neighborhood: row.neighborhood, city: row.city, state: row.state, demo: Boolean(row.demo) }
}

export function listProducts(q = '', category = ''): Product[] {
  const rows = getDb().prepare('SELECT id,name,brand,category,unit FROM product WHERE active=1').all() as any[]
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  return rows.filter((row) => (!category || normalized(row.category) === normalized(category)) && (!q || normalized(`${row.name} ${row.brand}`).includes(normalized(q)))).map(productRow)
}

export function listMarkets(state = process.env.UF_PADRAO || 'AC'): Market[] {
  return (getDb().prepare('SELECT id,name,address,neighborhood,city,state,demo FROM market WHERE active=1 AND state=? ORDER BY name').all(state.toUpperCase()) as any[]).map(marketRow)
}

export function getProductOffers(productId: string, state = process.env.UF_PADRAO || 'AC', marketId?: string) {
  const raw = getDb().prepare(`SELECT p.id, p.rowid AS insertion_order, m.id AS market_id, m.name AS market_name, m.address, m.neighborhood, m.city, m.state, m.demo, p.value_cents, p.collected_at, p.verified, p.source
    FROM price p JOIN market m ON m.id=p.market_id WHERE p.product_id=? AND m.state=? AND m.active=1 ${marketId ? 'AND m.id=?' : ''}
    ORDER BY p.rowid DESC`)
    .all(...(marketId ? [productId, state.toUpperCase(), marketId] : [productId, state.toUpperCase()])) as any[]
  const latestByMarket = new Map<string, any>()
  for (const row of raw) if (!latestByMarket.has(row.market_id)) latestByMarket.set(row.market_id, row)
  return rankPrices([...latestByMarket.values()].map((r) => ({ id: r.id, market_id: r.market_id, market_name: r.market_name, address: r.address, neighborhood: r.neighborhood, city: r.city, state: r.state, demo: Boolean(r.demo), price_cents: r.value_cents, collected_at: r.collected_at, verified: Boolean(r.verified), source: r.source })), new Date())
    .map((r) => ({ id: r.id, market: { id: r.market_id, name: r.market_name, address: r.address, neighborhood: r.neighborhood, city: r.city, state: r.state, demo: r.demo }, price_cents: r.price_cents, collected_at: r.collected_at, verified: r.verified, valid: r.valid, ranked: r.ranked, source: r.source as 'painel' | 'api' | 'seed' }))
}

const globalForDb = globalThis as typeof globalThis & { compraFacilDb?: Database.Database }

function createDatabase() {
  const filename = process.env.DB_PATH ?? process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'comprafacil.sqlite')
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true })
  const db = new Database(filename)
  db.pragma('foreign_keys = ON')
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
  db.exec(fs.readFileSync(schemaPath, 'utf8'))
  const priceColumns = db.prepare('PRAGMA table_info(price)').all() as { name: string }[]
  if (!priceColumns.some((column) => column.name === 'verified')) {
    db.exec('ALTER TABLE price ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1))')
  }
  const marketColumns = db.prepare('PRAGMA table_info(market)').all() as { name: string }[]
  if (!marketColumns.some((column) => column.name === 'state')) {
    db.exec("ALTER TABLE market ADD COLUMN state TEXT NOT NULL DEFAULT 'AC'")
  }
  return db
}

export function getDb() {
  return (globalForDb.compraFacilDb ??= createDatabase())
}
