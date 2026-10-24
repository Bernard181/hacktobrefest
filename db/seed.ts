import { getDb } from '../lib/db'
import { hashPassword } from '../lib/auth'

// This reset creates public demo data and a development-only merchant account.
export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset com credenciais demo não pode rodar em produção')

  const passwordHash = await hashPassword('demo123')
  const db = getDb()
  const seed = db.transaction(() => {
  db.exec('DELETE FROM price; DELETE FROM user; DELETE FROM product; DELETE FROM market;')
  const market = db.prepare('INSERT INTO market (id,name,address,neighborhood,city,active,demo) VALUES (?,?,?,?,?,?,?)')
  market.run('arasuper', 'Arasuper', null, null, 'Rio Branco', 1, 0)
  market.run('assai', 'Assaí', null, null, 'Rio Branco', 1, 0)
  const demoMarkets = [
    ['M1', 'Mercado Centro', 'Rua A, 100', 'Centro'],
    ['M2', 'Mercado Bosque', 'Rua B, 200', 'Bosque'],
    ['M3', 'Mercado Floresta', 'Rua C, 300', 'Floresta'],
  ]
  for (const [id, name, address, neighborhood] of demoMarkets) market.run(id, name, `${address} — ${neighborhood}, Rio Branco/AC`, neighborhood, 'Rio Branco', 1, 1)

  db.prepare('INSERT INTO user (id,email,password_hash,role,market_id) VALUES (?,?,?,?,?)')
    .run('merchant-arasuper', 'lojista@comprafacil.local', passwordHash, 'merchant', 'arasuper')

  const product = db.prepare('INSERT INTO product (id,name,brand,category,unit,active) VALUES (?,?,?,?,?,1)')
  const real = [
    ['arroz-brilhante-5kg', 'Arroz', 'Brilhante', 'Grãos', '5 kg'],
    ['feijao-dona-de-1kg', 'Feijão', 'Dona de', 'Grãos', '1 kg'],
    ['acucar-itamarati-1kg', 'Açúcar', 'Itamarati', 'Mercearia', '1 kg'],
    ['cafe-vovo-pureza-250g', 'Café', 'Vovó Pureza', 'Bebidas', '250 g'],
    ['farinha-campesina-1kg', 'Farinha de trigo', 'Campesina', 'Mercearia', '1 kg'],
  ]
  for (const row of real) product.run(...row)
  const demo = [
    ['P1', 'Arroz Branco', '', 'Grãos', '5 kg'], ['P2', 'Arroz Branco', '', 'Grãos', '1 kg'],
    ['P3', 'Leite Integral', '', 'Laticínios', '1 L'], ['P4', 'Feijão Carioca', '', 'Grãos', '1 kg'],
  ]
  for (const row of demo) product.run(...row)

  const price = db.prepare('INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source) VALUES (?,?,?,?,?,?)')
  const realPrices: [string, string, number][] = [
    ['arroz-brilhante-5kg', 'arasuper', 2799], ['feijao-dona-de-1kg', 'arasuper', 759], ['acucar-itamarati-1kg', 'arasuper', 309], ['cafe-vovo-pureza-250g', 'arasuper', 1399], ['farinha-campesina-1kg', 'arasuper', 559],
    ['arroz-brilhante-5kg', 'assai', 2349], ['farinha-campesina-1kg', 'assai', 349], ['cafe-vovo-pureza-250g', 'assai', 1249], ['feijao-dona-de-1kg', 'assai', 665], ['acucar-itamarati-1kg', 'assai', 249],
  ]
  realPrices.forEach(([productId, marketId, cents], index) => price.run(`real-${index + 1}`, marketId, productId, cents, null, 'seed'))
  const fixtures: [string, string, number, string][] = [
    ['P1', 'M1', 2890, '2026-10-24'], ['P1', 'M2', 2750, '2026-10-23'], ['P1', 'M3', 2650, '2026-09-20'],
    ['P4', 'M1', 1990, '2026-10-20'], ['P4', 'M2', 1990, '2026-10-22'],
    ['P3', 'M1', 499, '2026-10-24'], ['P3', 'M2', 519, '2026-10-24'],
  ]
  fixtures.forEach(([productId, marketId, cents, collected], index) => price.run(`demo-${index + 1}`, marketId, productId, cents, collected, 'seed'))
  })
  seed()
  console.log('Banco inicializado com catálogo real sem data de coleta e fixtures de demonstração.')
}

// tsx executes this file as CommonJS in the current package configuration.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/db/seed.ts')) {
  seedDatabase().catch((error: unknown) => {
    console.error('Falha ao inicializar banco:', error)
    process.exitCode = 1
  })
}
