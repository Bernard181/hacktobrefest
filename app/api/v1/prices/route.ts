import { NextRequest, NextResponse } from 'next/server'
import { getDb, getProductOffers, productRow } from '@/lib/db'

export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Access-Control-Allow-Origin': '*' } })
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const productId = params.get('product_id')
  if (!productId || !/^[\w.-]+$/.test(productId)) return json({ error: 'product_id inválido' }, 400)
  const row = getDb().prepare('SELECT id,name,brand,category,unit FROM product WHERE id=? AND active=1').get(productId)
  if (!row) return json({ error: 'Produto não encontrado' }, 404)
  const city = params.get('city') || 'Rio Branco'
  return json({ product: productRow(row), offers: getProductOffers(productId, city) })
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }) }
