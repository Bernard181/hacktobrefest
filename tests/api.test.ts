import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const authState = vi.hoisted(() => ({ user: { id: 'user-m1', email: 'merchant@example.test', role: 'merchant' as const, marketId: 'M1' as string | null } }))
vi.mock('@/lib/auth', () => ({ requireMerchant: async () => authState.user, hashPassword: async (password: string) => `test-hash:${password}` }))

process.env.DB_PATH = ':memory:'
let getDb: typeof import('@/lib/db')['getDb']
let bootstrapBaseCatalog: typeof import('@/lib/db')['bootstrapBaseCatalog']
let migrateDatabase: typeof import('@/lib/db')['migrateDatabase']
let productsGET: typeof import('@/app/api/v1/products/route')['GET']
let pricesGET: typeof import('@/app/api/v1/prices/route')['GET']
let marketsGET: typeof import('@/app/api/v1/markets/route')['GET']
let merchantGET: typeof import('@/app/api/merchant/prices/route')['GET']
let merchantPOST: typeof import('@/app/api/merchant/prices/route')['POST']

beforeAll(async () => {
  ;({ getDb, bootstrapBaseCatalog, migrateDatabase } = await import('@/lib/db'))
  ;({ GET: productsGET } = await import('@/app/api/v1/products/route'))
  ;({ GET: pricesGET } = await import('@/app/api/v1/prices/route'))
  ;({ GET: marketsGET } = await import('@/app/api/v1/markets/route'))
  ;({ GET: merchantGET, POST: merchantPOST } = await import('@/app/api/merchant/prices/route'))
  const { seedDatabase } = await import('@/db/seed')
  await seedDatabase()
})
const req = (url: string) => new NextRequest(`http://localhost${url}`)
const postReq = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
beforeEach(() => { authState.user = { id: 'user-m1', email: 'merchant@example.test', role: 'merchant', marketId: 'M1' } })

describe('API pública (contrato v1)', () => {
  it('API-01 filtra categoria', async () => {
    const response = await productsGET(req('/api/v1/products?category=Gr%C3%A3os'))
    expect((await response.json()).items.every((item: any) => item.category === 'Grãos')).toBe(true)
  })
  it('API-02 busca sem caixa ou acento', async () => {
    const response = await productsGET(req('/api/v1/products?q=acucar'))
    expect((await response.json()).items.some((item: any) => item.id === 'acucar-itamarati-1kg')).toBe(true)
  })
  it('API-03 retorna preços e mercado', async () => {
    const response = await pricesGET(req('/api/v1/prices?product_id=P1'))
    const json = await response.json()
    expect(json.offers[0]).toMatchObject({ price_cents: 2750, market: { id: 'M2', address: 'Rua B, 200 — Bosque, Rio Branco/AC' }, collected_at: '2026-10-23' })
  })
  it('API-15 distingue dados confirmados de preços atuais, com coleta informada', async () => {
    const response = await pricesGET(req('/api/v1/prices?product_id=arroz-brilhante-5kg'))
    const offers = (await response.json()).offers
    expect(offers.find((offer: any) => offer.market.id === 'arasuper')).toMatchObject({ verified: true, collected_at: '2026-10-24', valid: true, ranked: true, market: { state: 'AC' } })
    expect(offers.find((offer: any) => offer.market.id === 'assai')).toMatchObject({ verified: true, collected_at: '2026-10-24', valid: true, ranked: true, market: { state: 'AC' } })
  })
  it('API-04 inclui vencido sinalizado e fora do ranking', async () => {
    const response = await pricesGET(req('/api/v1/prices?product_id=P1'))
    expect((await response.json()).offers.find((item: any) => item.market.id === 'M3')).toMatchObject({ valid: false, ranked: false })
  })
  it('API-05 responde 404 consistente para produto inexistente', async () => expect((await pricesGET(req('/api/v1/prices?product_id=unknown'))).status).toBe(404))
  it('API-06 inclui CORS', async () => expect((await productsGET(req('/api/v1/products'))).headers.get('access-control-allow-origin')).toBe('*'))
  it('API-07 permite leitura sem credencial', async () => expect((await marketsGET(req('/api/v1/markets'))).status).toBe(200))
  it('API-08 lista mercados com endereço e cidade', async () => {
    const items = (await (await marketsGET(req('/api/v1/markets'))).json()).items
    expect(items.find((item: any) => item.id === 'arasuper')).toMatchObject({ name: 'Arasuper', city: 'Rio Branco', state: 'AC', demo: false })
    expect(items.some((item: any) => item.demo)).toBe(false)
  })
  it('API-18 retorna image_url local no contrato público de produto', async () => {
    const response = await productsGET(req('/api/v1/products?q=brilhante'))
    const product = (await response.json()).items[0]
    expect(product.image_url).toBe('/products/arroz-brilhante-5kg.webp')
    expect(fs.existsSync(path.join(process.cwd(), 'public', product.image_url.slice(1)))).toBe(true)
  })
  it('API-17 filtra mercados e preços por todo o estado informado', async () => {
    getDb().prepare("INSERT INTO market (id,name,city,state,active,demo) VALUES ('market-cruzeiro','Mercado de Cruzeiro do Sul','Cruzeiro do Sul','AC',1,0)").run()
    getDb().prepare("INSERT INTO market (id,name,city,state,active,demo) VALUES ('market-outside-ac','Mercado fora do Acre','São Paulo','SP',1,0)").run()
    getDb().prepare("INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES ('acre-price','market-cruzeiro','arroz-brilhante-5kg',2400,'2026-10-24','seed',1)").run()
    getDb().prepare("INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES ('outside-ac-price','market-outside-ac','arroz-brilhante-5kg',2300,'2026-10-24','seed',1)").run()
    const markets = (await (await marketsGET(req('/api/v1/markets?state=AC'))).json()).items
    const offers = (await (await pricesGET(req('/api/v1/prices?product_id=arroz-brilhante-5kg&state=AC'))).json()).offers
    expect(markets.some((market: any) => market.city === 'Cruzeiro do Sul' && market.state === 'AC')).toBe(true)
    expect(markets.some((market: any) => market.id === 'market-outside-ac')).toBe(false)
    expect(offers.some((offer: any) => offer.market.id === 'market-cruzeiro')).toBe(true)
    expect(offers.some((offer: any) => offer.market.id === 'market-outside-ac')).toBe(false)
  })
  it('API-09 rejeita query ausente/malformada sem erro interno', async () => {
    expect((await pricesGET(req('/api/v1/prices'))).status).toBe(400)
    expect((await pricesGET(req('/api/v1/prices?product_id=%2Fbad'))).status).toBe(400)
  })
  it('UT-10 GET por produto 5 kg não inclui preço cadastrado para produto de 1 kg', async () => {
    getDb().prepare('INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source) VALUES (?,?,?,?,?,?)')
      .run('unit-test-p2', 'M1', 'P2', 100, '2026-10-24', 'seed')
    const fiveKg = await (await pricesGET(req('/api/v1/prices?product_id=P1'))).json()
    const oneKg = await (await pricesGET(req('/api/v1/prices?product_id=P2'))).json()
    expect(fiveKg.offers.some((offer: any) => offer.id === 'unit-test-p2')).toBe(false)
    expect(oneKg.offers.some((offer: any) => offer.id === 'unit-test-p2')).toBe(true)
    expect(fiveKg.product.unit).toBe('5 kg')
    expect(oneKg.product.unit).toBe('1 kg')
  })
  it('UT-15 busca real por nome inexistente retorna items vazio', async () => {
    const response = await productsGET(req('/api/v1/products?q=produto-inexistente'))
    expect(response.status).toBe(200)
    expect((await response.json()).items).toEqual([])
  })
})

describe('API de lojista', () => {
  it('UT-12 restringe leitura ao mercado da sessão', async () => {
    const items = (await (await merchantGET()).json()).items
    expect(items.every((item: any) => item.market.id === 'M1')).toBe(true)
  })
  it('rejeita market_id fornecido no corpo', async () => {
    const response = await merchantPOST(postReq('/api/merchant/prices', { product_id: 'P1', value_cents: 1000, collected_at: '2026-10-24', market_id: 'M2' }))
    expect(response.status).toBe(400)
  })
  it('UT-11 rejeita data futura e grava append-only no mercado da sessão', async () => {
    const invalid = await merchantPOST(postReq('/api/merchant/prices', { product_id: 'P1', value_cents: 999, collected_at: '2999-01-01' }))
    expect(invalid.status).toBe(400)
    const before = (getDb().prepare("SELECT COUNT(*) AS count FROM price WHERE market_id='M1' AND product_id='P1'").get() as any).count
    const created = await merchantPOST(postReq('/api/merchant/prices', { product_id: 'P1', value_cents: 999, collected_at: '2026-10-24' }))
    expect(created.status).toBe(201)
    expect((await created.json()).item).toMatchObject({ verified: true, collected_at: '2026-10-24' })
    expect((getDb().prepare("SELECT COUNT(*) AS count FROM price WHERE market_id='M1' AND product_id='P1'").get() as any).count).toBe(before + 1)
    expect(getDb().prepare("SELECT 1 FROM price WHERE market_id='M1' AND product_id='P1' AND value_cents=2890").get()).toBeTruthy()
    expect((getDb().prepare("SELECT value_cents FROM price WHERE market_id='M1' AND product_id='P1' ORDER BY rowid DESC LIMIT 1").get() as any).value_cents).toBe(999)
    const currentOffers = await (await pricesGET(req('/api/v1/prices?product_id=P1'))).json()
    expect(currentOffers.offers.filter((offer: any) => offer.market.id === 'M1')).toHaveLength(1)
    expect(currentOffers.offers.find((offer: any) => offer.market.id === 'M1')).toMatchObject({ price_cents: 999, collected_at: '2026-10-24' })
  })
  it('UT-12 usa sempre o mercado vinculado à sessão', async () => {
    authState.user = { id: 'user-m1', email: 'merchant@example.test', role: 'merchant', marketId: 'M2' }
    const response = await merchantPOST(postReq('/api/merchant/prices', { product_id: 'P1', value_cents: 1000, collected_at: '2026-10-24' }))
    expect(response.status).toBe(201)
    expect((getDb().prepare("SELECT market_id FROM price WHERE product_id='P1' ORDER BY rowid DESC LIMIT 1").get() as any).market_id).toBe('M2')
    authState.user = { id: 'user-m1', email: 'merchant@example.test', role: 'merchant', marketId: null }
    expect((await merchantPOST(postReq('/api/merchant/prices', { product_id: 'P1', value_cents: 1000, collected_at: '2026-10-24' }))).status).toBe(403)
  })
  it('GET de lojista filtra pela UF do mercado vinculado à sessão', async () => {
    getDb().prepare("INSERT INTO market (id,name,city,state,active,demo) VALUES ('merchant-sp','Mercado SP','São Paulo','SP',1,0)").run()
    getDb().prepare("INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES ('merchant-sp-price','merchant-sp','P1',3000,'2026-10-24','painel',1)").run()
    authState.user = { id: 'merchant-sp-user', email: 'merchant-sp@example.test', role: 'merchant', marketId: 'merchant-sp' }
    const items = (await (await merchantGET()).json()).items
    expect(items).toHaveLength(1)
    expect(items[0].market).toMatchObject({ id: 'merchant-sp', state: 'SP' })
  })
})

describe('integridade do seed', () => {
  it('BOOT-01 inicializa catálogo vazio uma vez e preserva o que já existe', () => {
    const isolated = new Database(':memory:')
    try {
      const legacySchema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
        .replace(/^\s*state TEXT NOT NULL DEFAULT 'AC',\r?\n/m, '')
        .replace(/^\s*verified INTEGER NOT NULL DEFAULT 0 CHECK \(verified IN \(0, 1\)\),\r?\n/m, '')
        .replace(/^\s*image_url TEXT,\r?\n/m, '')
      isolated.exec(legacySchema)
      migrateDatabase(isolated)
      const migratedProducts = isolated.prepare('PRAGMA table_info(product)').all() as { name: string }[]
      expect(migratedProducts.some(({ name }) => name === 'image_url')).toBe(true)
      expect(bootstrapBaseCatalog(isolated)).toBe(true)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM product').get() as any).count).toBe(5)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM price').get() as any).count).toBe(10)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM user').get() as any).count).toBe(0)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM market WHERE demo=1').get() as any).count).toBe(0)
      const images = isolated.prepare('SELECT image_url FROM product ORDER BY id').all() as { image_url: string | null }[]
      expect(images).toHaveLength(5)
      expect(images.every(({ image_url }) => image_url?.startsWith('/products/'))).toBe(true)
      const basePrices = isolated.prepare('SELECT id,value_cents,collected_at,verified FROM price ORDER BY id').all() as any[]
      expect(basePrices.map(({ id, value_cents }) => [id, value_cents])).toEqual([
        ['base-arasuper-acucar-itamarati-1kg', 309], ['base-arasuper-arroz-brilhante-5kg', 2799], ['base-arasuper-cafe-vovo-pureza-250g', 1399], ['base-arasuper-farinha-campesina-1kg', 559], ['base-arasuper-feijao-dona-de-1kg', 759],
        ['base-assai-acucar-itamarati-1kg', 249], ['base-assai-arroz-brilhante-5kg', 2349], ['base-assai-cafe-vovo-pureza-250g', 1249], ['base-assai-farinha-campesina-1kg', 349], ['base-assai-feijao-dona-de-1kg', 665],
      ].sort(([left], [right]) => String(left).localeCompare(String(right))))
      expect(basePrices.every(({ collected_at, verified }) => collected_at === '2026-10-24' && verified === 1)).toBe(true)

      isolated.prepare("INSERT INTO product (id,name,brand,category,unit,image_url) VALUES ('preserve-me','Preservar','','Teste','1 un',NULL)").run()
      expect(bootstrapBaseCatalog(isolated)).toBe(false)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM product').get() as any).count).toBe(6)
      expect((isolated.prepare('SELECT COUNT(*) AS count FROM price').get() as any).count).toBe(10)
      expect(isolated.prepare("SELECT id FROM product WHERE id='preserve-me'").get()).toBeTruthy()
    } finally {
      isolated.close()
    }
  })
  it('SEED-01 contém três mercados fictícios ativos em Rio Branco', () => {
    const rows = getDb().prepare("SELECT COUNT(*) AS count FROM market WHERE demo=1 AND active=1 AND city='Rio Branco'").get() as any
    expect(rows.count).toBe(3)
  })
  it('SEED-02 inclui P1 nos três mercados, com um preço vencido', () => {
    const rows = getDb().prepare("SELECT collected_at FROM price WHERE id IN ('demo-1','demo-2','demo-3') AND product_id='P1' AND market_id IN ('M1','M2','M3')").all() as any[]
    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => !row.collected_at || row.collected_at < '2026-09-24')).toHaveLength(1)
  })
  it('SEED-03 inclui empate de P4 com datas distintas', () => {
    const rows = getDb().prepare("SELECT value_cents,collected_at FROM price WHERE id IN ('demo-4','demo-5') AND product_id='P4'").all() as any[]
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((row) => row.value_cents))).toEqual(new Set([1990]))
    expect(new Set(rows.map((row) => row.collected_at)).size).toBe(2)
  })
  it('SEED-04 só inclui valores positivos inteiros e datas não futuras', () => {
    const rows = getDb().prepare('SELECT value_cents,collected_at FROM price').all() as any[]
    expect(rows.every((row) => Number.isInteger(row.value_cents) && row.value_cents > 0 && (!row.collected_at || row.collected_at <= '2026-10-24'))).toBe(true)
  })
  it('SEED-05 marca como verificados os dez preços fornecidos para os mercados reais', () => {
    const rows = getDb().prepare("SELECT COUNT(*) AS count FROM price WHERE id LIKE 'base-%' AND verified=1 AND collected_at='2026-10-24'").get() as any
    expect(rows.count).toBe(10)
  })
  it('SM-04 cria usuário de demonstração com senha apenas como hash e vínculo Arasuper', () => {
    const user = getDb().prepare("SELECT email,password_hash,role,market_id FROM user WHERE email='lojista@comprafacil.local'").get() as any
    expect(user).toMatchObject({ email: 'lojista@comprafacil.local', role: 'merchant', market_id: 'arasuper' })
    expect(user.password_hash).toBe('test-hash:demo123')
    expect(user.password_hash).not.toBe('demo123')
  })
})
