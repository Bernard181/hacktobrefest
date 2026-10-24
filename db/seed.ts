import { bootstrapBaseCatalog, getDb } from '../lib/db'
import { hashPassword } from '../lib/auth'

/** Destructive local reset: demo fixtures and credentials are development-only. */
export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset com fixtures e credenciais demo não pode rodar em produção')

  const passwordHash = await hashPassword('demo123')
  const db = getDb()
  db.transaction(() => {
    db.exec('DELETE FROM price; DELETE FROM user; DELETE FROM product; DELETE FROM market;')
    bootstrapBaseCatalog(db)

    const market = db.prepare('INSERT INTO market (id,name,address,neighborhood,city,state,active,demo) VALUES (?,?,?,?,?,?,?,?)')
    const demoMarkets = [
      ['M1', 'Mercado Centro', 'Rua A, 100', 'Centro'],
      ['M2', 'Mercado Bosque', 'Rua B, 200', 'Bosque'],
      ['M3', 'Mercado Floresta', 'Rua C, 300', 'Floresta'],
    ]
    for (const [id, name, address, neighborhood] of demoMarkets) market.run(id, name, `${address} — ${neighborhood}, Rio Branco/AC`, neighborhood, 'Rio Branco', 'AC', 1, 1)

    db.prepare('INSERT INTO user (id,email,password_hash,role,market_id) VALUES (?,?,?,?,?)')
      .run('merchant-arasuper', 'lojista@comprafacil.local', passwordHash, 'merchant', 'arasuper')

    const product = db.prepare('INSERT INTO product (id,name,brand,category,unit,image_url,active) VALUES (?,?,?,?,?,NULL,1)')
    const demoProducts = [
      ['P1', 'Arroz Branco', '', 'Grãos', '5 kg'], ['P2', 'Arroz Branco', '', 'Grãos', '1 kg'],
      ['P3', 'Leite Integral', '', 'Laticínios', '1 L'], ['P4', 'Feijão Carioca', '', 'Grãos', '1 kg'],
    ]
    for (const row of demoProducts) product.run(...row)

    const price = db.prepare('INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES (?,?,?,?,?,?,0)')
    const fixtures: [string, string, number, string][] = [
      ['P1', 'M1', 2890, '2026-10-24'], ['P1', 'M2', 2750, '2026-10-23'], ['P1', 'M3', 2650, '2026-09-20'],
      ['P4', 'M1', 1990, '2026-10-20'], ['P4', 'M2', 1990, '2026-10-22'],
      ['P3', 'M1', 499, '2026-10-24'], ['P3', 'M2', 519, '2026-10-24'],
    ]
    fixtures.forEach(([productId, marketId, cents, collected], index) => price.run(`demo-${index + 1}`, marketId, productId, cents, collected, 'seed'))
  })()
  console.log('Banco reiniciado com preços-base e fixtures de demonstração (somente desenvolvimento).')
}

// tsx executes this file as CommonJS in the current package configuration.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/db/seed.ts')) {
  seedDatabase().catch((error: unknown) => {
    console.error('Falha ao inicializar banco:', error)
    process.exitCode = 1
  })
}
