import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { rankPrices } from './prices'

export type Product = { id: string; name: string; brand: string; category: string; unit: string; image_url: string | null }
export type Market = { id: string; name: string; address: string | null; neighborhood: string | null; city: string; state: string; demo: boolean }

export function productRow(row: any): Product {
  return { id: row.id, name: row.name, brand: row.brand, category: row.category, unit: row.unit, image_url: row.image_url ?? null }
}

export function marketRow(row: any): Market {
  return { id: row.id, name: row.name, address: row.address, neighborhood: row.neighborhood, city: row.city, state: row.state, demo: Boolean(row.demo) }
}

export function listProducts(q = '', category = ''): Product[] {
  const rows = getDb().prepare('SELECT id,name,brand,category,unit,image_url FROM product WHERE active=1').all() as any[]
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  return rows.filter((row) => (!category || normalized(row.category) === normalized(category)) && (!q || normalized(`${row.name} ${row.brand}`).includes(normalized(q)))).map(productRow)
}

export function listMarkets(state = process.env.UF_PADRAO || 'AC'): Market[] {
  return (getDb().prepare('SELECT id,name,address,neighborhood,city,state,demo FROM market WHERE active=1 AND demo=0 AND state=? ORDER BY name').all(state.toUpperCase()) as any[]).map(marketRow)
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

const BASE_PRODUCTS = [
  { id: 'arroz-brilhante-5kg', name: 'Arroz', brand: 'Brilhante', category: 'Grãos', unit: '5 kg', image_url: '/products/arroz-brilhante-5kg.webp' },
  { id: 'feijao-dona-de-1kg', name: 'Feijão', brand: 'Dona de', category: 'Grãos', unit: '1 kg', image_url: '/products/feijao-dona-de-1kg.webp' },
  { id: 'acucar-itamarati-1kg', name: 'Açúcar', brand: 'Itamarati', category: 'Mercearia', unit: '1 kg', image_url: '/products/acucar-itamarati-1kg.webp' },
  { id: 'cafe-vovo-pureza-250g', name: 'Café', brand: 'Vovó Pureza', category: 'Bebidas', unit: '250 g', image_url: '/products/cafe-vovo-pureza-250g.webp' },
  { id: 'farinha-campesina-1kg', name: 'Farinha de trigo', brand: 'Campesina', category: 'Mercearia', unit: '1 kg', image_url: '/products/farinha-campesina-1kg.webp' },
] as const

const BASE_PRICES: readonly [string, string, number][] = [
  ['arroz-brilhante-5kg', 'arasuper', 2799], ['feijao-dona-de-1kg', 'arasuper', 759], ['acucar-itamarati-1kg', 'arasuper', 309], ['cafe-vovo-pureza-250g', 'arasuper', 1399], ['farinha-campesina-1kg', 'arasuper', 559],
  ['arroz-brilhante-5kg', 'assai', 2349], ['farinha-campesina-1kg', 'assai', 349], ['cafe-vovo-pureza-250g', 'assai', 1249], ['feijao-dona-de-1kg', 'assai', 665], ['acucar-itamarati-1kg', 'assai', 249],
]

/** Bootstrap the real base catalog only on an empty catalog; safe to run at every startup. */
export function bootstrapBaseCatalog(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM product').get() as { count: number }).count
  if (count !== 0) return false

  const addMarket = db.prepare("INSERT OR IGNORE INTO market (id,name,address,neighborhood,city,state,active,demo) VALUES (?,?,NULL,NULL,'Rio Branco','AC',1,0)")
  addMarket.run('arasuper', 'Arasuper')
  addMarket.run('assai', 'Assaí')

  const insertProduct = db.prepare('INSERT INTO product (id,name,brand,category,unit,image_url,active) VALUES (?,?,?,?,?,?,1)')
  for (const product of BASE_PRODUCTS) insertProduct.run(product.id, product.name, product.brand, product.category, product.unit, product.image_url)

  const insertPrice = db.prepare('INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES (?,?,?,?,?,?,1)')
  for (const [productId, marketId, cents] of BASE_PRICES) {
    insertPrice.run(`base-${marketId}-${productId}`, marketId, productId, cents, '2026-10-24', 'seed')
  }
  return true
}

function createDatabase() {
  const filename = process.env.DB_PATH ?? process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'comprafacil.sqlite')
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true })
  const db = new Database(filename)
  db.pragma('foreign_keys = ON')
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
  db.exec(fs.readFileSync(schemaPath, 'utf8'))
  migrateDatabase(db)
  return db
}

export function migrateDatabase(db: Database.Database) {
  const priceColumns = db.prepare('PRAGMA table_info(price)').all() as { name: string }[]
  if (!priceColumns.some((column) => column.name === 'verified')) {
    db.exec('ALTER TABLE price ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1))')
  }
  const marketColumns = db.prepare('PRAGMA table_info(market)').all() as { name: string }[]
  if (!marketColumns.some((column) => column.name === 'state')) {
    db.exec("ALTER TABLE market ADD COLUMN state TEXT NOT NULL DEFAULT 'AC'")
  }
  const productColumns = db.prepare('PRAGMA table_info(product)').all() as { name: string }[]
  if (!productColumns.some((column) => column.name === 'image_url')) {
    db.exec('ALTER TABLE product ADD COLUMN image_url TEXT')
  }
}

export function getDb() {
  if (!globalForDb.compraFacilDb) {
    const db = createDatabase()
    globalForDb.compraFacilDb = db
    db.transaction(() => bootstrapBaseCatalog(db))()
  }
  return globalForDb.compraFacilDb!
}
