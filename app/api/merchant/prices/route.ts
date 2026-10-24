import { NextRequest, NextResponse } from 'next/server'
import { getDb, getProductOffers, productRow } from '@/lib/db'
import { requireMerchant } from '@/lib/auth'

export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
async function merchant() {
  try { return { user: await requireMerchant() } }
  catch (error) { return { response: json({ error: error instanceof Error ? error.message : 'Não autorizado' }, Number((error as { status?: number })?.status) || 401) } }
}
export async function GET() {
  const auth = await merchant()
  if (auth.response) return auth.response
  const marketId = auth.user!.marketId
  if (!marketId) return json({ error: 'Vínculo de mercado obrigatório' }, 403)
  const products = getDb().prepare('SELECT DISTINCT product_id FROM price WHERE market_id=?').all(marketId) as { product_id: string }[]
  const items = products.flatMap(({ product_id }) => {
    const p = getDb().prepare('SELECT id,name,brand,category,unit FROM product WHERE id=?').get(product_id)
    if (!p) return []
    const product = productRow(p)
    return getProductOffers(product_id, 'Rio Branco', marketId).map((offer) => ({ ...offer, product }))
  })
  return json({ items })
}
export async function POST(request: NextRequest) {
  const auth = await merchant()
  if (auth.response) return auth.response
  const user = auth.user!
  const marketId = user.marketId
  if (!marketId) return json({ error: 'Vínculo de mercado obrigatório' }, 403)
  let body: any
  try { body = await request.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  if (Object.hasOwn(body ?? {}, 'market_id') || Object.hasOwn(body ?? {}, 'marketId')) return json({ error: 'market_id não pode ser informado' }, 400)
  const { product_id, value_cents, collected_at } = body ?? {}
  if (typeof product_id !== 'string' || !/^[\w.-]+$/.test(product_id) || !Number.isSafeInteger(value_cents) || value_cents <= 0 || typeof collected_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(collected_at)) return json({ error: 'Dados inválidos' }, 400)
  const date = new Date(`${collected_at}T00:00:00.000Z`)
  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== collected_at || date > today) return json({ error: 'Data de coleta inválida ou futura' }, 400)
  const db = getDb()
  if (!db.prepare('SELECT 1 FROM product WHERE id=? AND active=1').get(product_id)) return json({ error: 'Produto não encontrado' }, 400)
  if (!db.prepare('SELECT 1 FROM market WHERE id=? AND active=1').get(marketId)) return json({ error: 'Mercado não encontrado' }, 403)
  const id = `price-${crypto.randomUUID()}`
  db.prepare('INSERT INTO price (id,market_id,product_id,value_cents,collected_at,source,verified) VALUES (?,?,?,?,?,?,1)').run(id, marketId, product_id, value_cents, collected_at, 'painel')
  const created = db.prepare('SELECT id,value_cents,collected_at,verified,source FROM price WHERE id=?').get(id) as any
  return json({ item: { id: created.id, product_id, market_id: marketId, price_cents: created.value_cents, collected_at: created.collected_at, verified: Boolean(created.verified), source: created.source } }, 201)
}
