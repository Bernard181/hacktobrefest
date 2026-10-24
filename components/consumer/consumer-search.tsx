'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './consumer.module.css'

type Product = { id: string; name: string; brand: string; category: string; unit: string }
type Market = { id: string; name: string; address: string | null; neighborhood: string | null; city: string; demo: boolean }
type Offer = { id: string; market: Market; price_cents: number; collected_at: string | null; valid: boolean; ranked: boolean; source: 'painel' | 'api' | 'seed' }
type PriceResponse = { product: Product; offers: Offer[] }

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Data não informada'
const cellStyle: React.CSSProperties = { padding: '14px 12px', borderBottom: '1px solid #e4ebe5', verticalAlign: 'top', textAlign: 'left' }

export function ConsumerSearch() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [offersByProduct, setOffersByProduct] = useState<Record<string, Offer[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (category) params.set('category', category)
        const [productResponse, marketResponse] = await Promise.all([
          fetch(`/api/v1/products${params.size ? `?${params}` : ''}`, { signal: controller.signal }),
          fetch('/api/v1/markets?city=Rio%20Branco', { signal: controller.signal }),
        ])
        if (!productResponse.ok || !marketResponse.ok) throw new Error('Não foi possível carregar os dados. Tente novamente.')
        const productData = await productResponse.json() as { items: Product[] }
        const marketData = await marketResponse.json() as { items: Market[] }
        setProducts(productData.items)
        setMarkets(marketData.items)
        const results = await Promise.all(productData.items.map(async product => {
          const response = await fetch(`/api/v1/prices?product_id=${encodeURIComponent(product.id)}&city=Rio%20Branco`, { signal: controller.signal })
          if (!response.ok) throw new Error('Não foi possível carregar os preços. Tente novamente.')
          const data = await response.json() as PriceResponse
          return [product.id, data.offers] as const
        }))
        setOffersByProduct(Object.fromEntries(results))
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Ocorreu um erro ao carregar os dados.')
        setProducts([])
        setOffersByProduct({})
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    const timeout = window.setTimeout(load, 180)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [query, category])

  const categories = useMemo(() => [...new Set(products.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [products])
  const rankedOffers = (offers: Offer[]) => offers.filter(offer => offer.ranked)
  const diff = (offers: Offer[]) => {
    const ranked = rankedOffers(offers)
    if (ranked.length < 2) return '—'
    return money(Math.max(...ranked.map(o => o.price_cents)) - Math.min(...ranked.map(o => o.price_cents)))
  }

  return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px clamp(16px, 4vw, 36px) 56px', color: '#20362a' }}>
    <header style={{ marginBottom: 26 }}>
      <p style={{ margin: '0 0 8px', color: '#4a7657', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', fontSize: 13 }}>Rio Branco · Acre</p>
      <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 40px)' }}>Compare preços</h1>
      <p style={{ color: '#536359', margin: '10px 0 0' }}>Encontre e compare ofertas por produto e mercado.</p>
    </header>

    <section aria-label="Busca de produtos" className={styles.searchGrid}>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Buscar produto
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: arroz" type="search" style={{ minHeight: 46, border: '1px solid #aab9ad', borderRadius: 8, padding: '10px 12px', background: '#fff' }} />
      </label>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Categoria
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ minHeight: 46, border: '1px solid #aab9ad', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
          <option value="">Todas as categorias</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </section>

    {loading && <p role="status" aria-live="polite">Carregando produtos e preços…</p>}
    {!loading && error && <p role="alert" style={{ padding: 16, borderRadius: 8, background: '#fff1ef', color: '#8b2319' }}>{error}</p>}
    {!loading && !error && products.length === 0 && <p role="status">Nenhum produto encontrado. Tente outra busca ou categoria.</p>}
    {!loading && !error && products.length > 0 && <>
      {markets.some(m => m.demo) && <p style={{ fontSize: 14, color: '#536359' }}>Os mercados identificados como demonstração usam dados de demonstração.</p>}
      <div style={{ overflowX: 'auto', border: '1px solid #dce6dd', borderRadius: 10, background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: Math.max(720, 330 + markets.length * 230) }}>
          <caption style={{ textAlign: 'left', padding: 14, fontWeight: 700 }}>Comparação por produto e mercado</caption>
          <thead><tr style={{ background: '#f0f5f0' }}>
            <th scope="col" style={cellStyle}>Produto</th>
            {markets.map(m => <th scope="col" key={m.id} style={cellStyle}>{m.name}{m.demo && <small style={{ display: 'block', fontWeight: 400 }}>Demonstração</small>}</th>)}
            <th scope="col" style={cellStyle}>Diferença*</th>
          </tr></thead>
          <tbody>{products.map(product => {
            const offers = offersByProduct[product.id] ?? []
            const ranked = rankedOffers(offers)
            const cheapest = ranked.length ? Math.min(...ranked.map(offer => offer.price_cents)) : null
            return <tr key={product.id}>
              <th scope="row" style={cellStyle}>{product.name}<small style={{ display: 'block', color: '#536359', fontWeight: 400 }}>{product.brand} · {product.unit} · {product.category}</small></th>
              {markets.map(market => {
                const offer = offers.find(item => item.market.id === market.id)
                if (!offer) return <td key={market.id} style={cellStyle}>Sem preço</td>
                return <td key={market.id} style={cellStyle}>
                  <strong>{money(offer.price_cents)}</strong>
                  {offer.ranked && offer.price_cents === cheapest && <span style={{ display: 'block', color: '#176336', fontWeight: 700, fontSize: 13 }}>Menor preço válido</span>}
                  {!offer.valid && offer.collected_at && <span style={{ display: 'block', color: '#9a3f19', fontWeight: 700, fontSize: 13 }}>Preço desatualizado</span>}
                  {!offer.collected_at && <span style={{ display: 'block', color: '#725a21', fontSize: 13 }}>Não verificado</span>}
                  <small style={{ display: 'block', color: '#536359', marginTop: 4 }}>Coleta: {date(offer.collected_at)}</small>
                  <small style={{ display: 'block', color: '#536359' }}>{market.address ?? 'Endereço não informado'}{market.neighborhood ? ` · ${market.neighborhood}` : ''}</small>
                </td>
              })}
              <td style={cellStyle}>{diff(offers)}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <p style={{ color: '#536359', fontSize: 13 }}>* Diferença entre ofertas ranqueadas do mesmo produto, calculada em centavos. O backend determina a validade e o ranking.</p>
    </>}
  </main>
}
