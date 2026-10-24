import { describe, expect, it } from 'vitest'

const baseUrl = 'http://localhost:3000'
type Product = { id: string; name: string; category: string; unit: string }
type Offer = { id: string; price_cents: number; collected_at: string | null; valid: boolean; ranked: boolean; source: 'painel' | 'api' | 'seed'; market: { id: string; name: string; address: string | null } }
type Prices = { product: Product; offers: Offer[] }
type MerchantOffer = { id: string; product: Product; market: { id: string }; price_cents: number }

async function products(q = '', category = ''): Promise<Product[]> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const response = await fetch(`${baseUrl}/api/v1/products?${params}`)
  expect(response.status).toBe(200)
  return (await response.json()).items
}

async function prices(productId: string): Promise<Prices> {
  const response = await fetch(`${baseUrl}/api/v1/prices?product_id=${encodeURIComponent(productId)}&state=AC`)
  expect(response.status).toBe(200)
  return response.json()
}

async function merchantSession(): Promise<string> {
  const loginPage = await fetch(`${baseUrl}/login`)
  expect(loginPage.status).toBe(200)
  const html = await loginPage.text()
  expect(html).toContain('Entre na sua conta')
  const actionField = html.match(/name="(\$ACTION_ID_[^"]+)"/)
  expect(actionField, 'login page must expose its server action form').toBeTruthy()
  const form = new FormData()
  form.set(actionField![1], '')
  form.set('email', 'lojista@comprafacil.local')
  form.set('password', 'demo123')
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
    headers: { Origin: baseUrl },
  })
  const setCookie = response.headers.get('set-cookie')
  expect(setCookie, 'valid demo credentials should establish a session').toBeTruthy()
  return setCookie!.split(';', 1)[0]
}

describe('Smoke — fluxo consumidor (SM-01..SM-06)', () => {
  it('SM-01 — abre busca pública sem login e encontra arroz em Grãos', async () => {
    const page = await fetch(baseUrl)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Compare preços')
    expect(html).toContain('Buscar produto')
    const found = await products('arroz', 'Grãos')
    expect(found.some(p => /arroz/i.test(p.name))).toBe(true)
  })

  it('SM-02 — retorna produto e ofertas com mercado, endereço, valor e data', async () => {
    const found = await products('arroz', 'Grãos')
    expect(found.length).toBeGreaterThan(0)
    const result = await prices(found[0].id)
    expect(result.product.id).toBe(found[0].id)
    expect(result.offers.length).toBeGreaterThan(0)
    for (const offer of result.offers) {
      expect(Number.isInteger(offer.price_cents)).toBe(true)
      expect(offer.market.name).toBeTruthy()
      expect('address' in offer.market).toBe(true)
      expect('collected_at' in offer).toBe(true)
    }
    const ranked = result.offers.filter(offer => offer.ranked)
    expect(ranked.map(offer => offer.price_cents)).toEqual([...ranked].map(offer => offer.price_cents).sort((a, b) => a - b))
  })

  it('SM-03 — preserva preço vencido visível fora do ranking', async () => {
    const found = await products('arroz', 'Grãos')
    const results = await Promise.all(found.map(product => prices(product.id)))
    const stale = results.flatMap(result => result.offers).find(offer => offer.valid === false && offer.collected_at !== null)
    expect(stale, 'seed deve incluir ao menos uma oferta vencida').toBeDefined()
    expect(stale?.ranked).toBe(false)
  })

  it('SM-04 — lojista entra, atualiza o próprio mercado e não pode escolher outro mercado', async () => {
    const cookie = await merchantSession()
    const dashboard = await fetch(`${baseUrl}/dashboard`, { headers: { Cookie: cookie }, redirect: 'manual' })
    expect(dashboard.status).toBe(200)
    expect(await dashboard.text()).toContain('Atualizar preço')

    const ownPrices = await fetch(`${baseUrl}/api/merchant/prices`, { headers: { Cookie: cookie } })
    expect(ownPrices.status).toBe(200)
    const ownItems = (await ownPrices.json()).items as MerchantOffer[]
    expect(ownItems.length).toBeGreaterThan(0)
    expect(ownItems.every(item => item.market.id === 'arasuper')).toBe(true)
    const product = (await products('arroz', 'Grãos'))[0]
    expect(product).toBeDefined()
    const collectedAt = new Date().toISOString().slice(0, 10)
    const payload = { product_id: product.id, value_cents: 12345, collected_at: collectedAt }
    const update = await fetch(`${baseUrl}/api/merchant/prices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: cookie },
      body: JSON.stringify(payload),
    })
    expect(update.status).toBe(201)

    const otherMarket = await fetch(`${baseUrl}/api/merchant/prices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ ...payload, market_id: 'assai' }),
    })
    expect(otherMarket.status).toBe(400)
    const after = await fetch(`${baseUrl}/api/merchant/prices`, { headers: { Cookie: cookie } })
    expect(after.status).toBe(200)
    const afterItems = (await after.json()).items as MerchantOffer[]
    expect(afterItems.some(item => item.product.id === product.id && item.price_cents === 12345)).toBe(true)
    expect(afterItems.every(item => item.market.id === 'arasuper')).toBe(true)
  })

  it('SM-05 — busca pública reflete a atualização do lojista', async () => {
    const found = await products('arroz', 'Grãos')
    const after = await prices(found[0].id)
    expect(after.offers.some(offer => offer.price_cents === 12345 && offer.source === 'painel')).toBe(true)
    const ranked = after.offers.filter(offer => offer.ranked)
    expect(ranked.map(offer => offer.price_cents)).toEqual([...ranked].map(offer => offer.price_cents).sort((a, b) => a - b))
  })

  it('SM-06 — API pública devolve o preço exibido em JSON sem credenciais', async () => {
    const found = await products('arroz', 'Grãos')
    const result = await prices(found[0].id)
    expect(result.product.id).toBe(found[0].id)
    expect(result.offers[0].market.name).toBeTruthy()
  })
})
