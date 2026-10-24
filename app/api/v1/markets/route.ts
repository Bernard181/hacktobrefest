import { NextRequest, NextResponse } from 'next/server'
import { listMarkets } from '@/lib/db'

export const runtime = 'nodejs'
const json = (body: unknown) => NextResponse.json(body, { headers: { 'Access-Control-Allow-Origin': '*' } })
export function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') || 'Rio Branco'
  return json({ items: listMarkets(city) })
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }) }
