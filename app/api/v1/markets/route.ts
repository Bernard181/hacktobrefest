import { NextRequest, NextResponse } from 'next/server'
import { listMarkets } from '@/lib/db'

export const runtime = 'nodejs'
const json = (body: unknown) => NextResponse.json(body, { headers: { 'Access-Control-Allow-Origin': '*' } })
export function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state') || process.env.UF_PADRAO || 'AC'
  return json({ items: listMarkets(state) })
}
export function OPTIONS() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }) }
