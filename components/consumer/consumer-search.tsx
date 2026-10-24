'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './consumer.module.css'
import { priceDifferenceCents } from './comparison'

type Product = { id: string; name: string; brand: string; category: string; unit: string }
type Market = { id: string; name: string; address: string | null; neighborhood: string | null; city: string; demo: boolean }
type Offer = { id: string; market: Market; price_cents: number; collected_at: string | null; verified: boolean; valid: boolean; ranked: boolean; source: 'painel' | 'api' | 'seed' }
type PriceResponse = { product: Product; offers: Offer[] }

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Data não informada'

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
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Ocorreu um erro ao carregar os dados.')
        setProducts([])
        setOffersByProduct({})
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    const timeout = window.setTimeout(load, 180)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [query, category])

  const categories = useMemo(() => [...new Set(products.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [products])
  const verifiedCount = Object.values(offersByProduct).flat().filter(offer => offer.verified).length

  return <main className={styles.page}>
    <nav className={styles.nav} aria-label="Navegação principal">
      <Link href="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true">C</span><span>compra<span>fácil</span></span></Link>
      <div className={styles.navRight}><span className={styles.location}><span aria-hidden="true">⌖</span> Rio Branco, AC</span><Link href="/login" className={styles.merchantLink}>Área do lojista <span aria-hidden="true">↗</span></Link></div>
    </nav>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}><span className={styles.liveDot} /> COMPRAS MAIS INTELIGENTES, TODO DIA</span>
        <h1>Seu dinheiro<br />vale <em>mais.</em></h1>
        <p>Compare os valores informados dos itens essenciais em mercados de Rio Branco e veja quando cada preço foi coletado.</p>
        <a href="#comparacao" className={styles.heroButton}>Comparar valores <span aria-hidden="true">↓</span></a>
      </div>
      <div className={styles.heroVisual} aria-hidden="true">
        <div className={`${styles.orbit} ${styles.orbitOne}`} /><div className={`${styles.orbit} ${styles.orbitTwo}`} />
        <div className={styles.receipt}><span className={styles.receiptLabel}>VALORES INFORMADOS · SEM DATA</span><div className={styles.receiptLine}><span>Arroz 5 kg</span><strong>R$ 23,49</strong></div><div className={styles.receiptLine}><span>Café 250 g</span><strong>R$ 12,49</strong></div><div className={styles.receiptLine}><span>Açúcar 1 kg</span><strong>R$ 2,49</strong></div><div className={styles.receiptTotal}><span>COMPARE COM CLAREZA</span><b>↘</b></div></div>
        <span className={styles.heroSparkle}>✳</span><span className={styles.heroBadge}>Preço a preço,<br />você decide.</span>
      </div>
      <div className={styles.heroBottom}><span>01 — COMPARE</span><span>02 — ESCOLHA</span><span>03 — ECONOMIZE</span></div>
    </section>

    <section className={styles.searchSection} id="comparacao" aria-label="Busca e comparação de preços">
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>PESQUISA DE PREÇOS</span><h2>O que vai na sua lista?</h2><p>Encontre um produto e veja como os mercados se comparam.</p></div>
        <span className={styles.productCount}>{products.length.toString().padStart(2, '0')} <small>produtos</small></span>
      </div>

      <div className={styles.searchCard}>
        <label className={styles.searchField}><span className={styles.fieldIcon} aria-hidden="true">⌕</span><span className={styles.srOnly}>Buscar produto</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Busque por produto ou marca…" type="search" /></label>
        <label className={styles.categoryField}><span className={styles.srOnly}>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select><span className={styles.selectChevron} aria-hidden="true">⌄</span></label>
        <span className={styles.searchHint}><kbd>⌕</kbd> Busque arroz, café, feijão…</span>
      </div>

      <div className={styles.trustNote}><span className={styles.trustIcon} aria-hidden="true">✓</span><span><strong>Informação clara, escolha sua.</strong> Os preços indicados como verificados foram confirmados como dados reais. Sem data de coleta, eles não são tratados como preços atuais.</span></div>

      {loading && <div className={styles.stateCard} role="status" aria-live="polite"><span className={styles.spinner} /> Carregando produtos e preços…</div>}
      {!loading && error && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><strong>Não conseguimos carregar os preços.</strong><span>{error}</span></div>}
      {!loading && !error && products.length === 0 && <div className={styles.stateCard} role="status"><strong>Nenhum produto encontrado.</strong><span>Tente outro nome ou escolha uma categoria diferente.</span></div>}

      {!loading && !error && products.length > 0 && <>
        <div className={styles.resultsBar}><div><span className={styles.sectionKicker}>SELEÇÃO DE PRODUTOS</span><h3>Compare lado a lado</h3></div><div className={styles.resultsMeta}><span className={styles.verifiedCount}><i /> {verifiedCount} preços verificados</span><span>{markets.length} mercados</span></div></div>
        <div className={styles.tableFrame}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Comparação de preços mais recentes por produto e mercado em Rio Branco</caption>
              <thead><tr><th scope="col" className={styles.productHeader}>PRODUTO</th>{markets.map(market => <th scope="col" key={market.id}>{market.name}{market.demo && <small className={styles.demoLabel}>Demonstração</small>}<small className={styles.marketAddress}>{market.address ?? 'Endereço não informado'}</small></th>)}<th scope="col" className={styles.differenceHeader}>DIFERENÇA</th></tr></thead>
              <tbody>{products.map(product => {
                const offers = offersByProduct[product.id] ?? []
                const difference = priceDifferenceCents(offers)
                const cheapest = Math.min(...offers.filter(offer => offer.ranked).map(offer => offer.price_cents), Number.POSITIVE_INFINITY)
                return <tr key={product.id}>
                  <th scope="row" className={styles.productCell}><span className={styles.productIcon} aria-hidden="true">{product.name.toLocaleLowerCase('pt-BR').includes('café') ? '☕' : product.name.toLocaleLowerCase('pt-BR').includes('arroz') ? '◉' : product.name.toLocaleLowerCase('pt-BR').includes('feijão') ? '◈' : '✳'}</span><span><strong>{product.name}</strong><small>{product.brand} · {product.unit}</small></span></th>
                  {markets.map(market => {
                    const offer = offers.find(item => item.market.id === market.id)
                    if (!offer) return <td key={market.id}><span className={styles.noPrice}>—</span></td>
                    return <td key={market.id}>
                      <div className={styles.price}>{money(offer.price_cents)}</div>
                      <div className={styles.statusStack}>
                        {offer.verified && <span className={styles.verifiedBadge}><span>✓</span> Verificado</span>}
                        {offer.ranked && offer.price_cents === cheapest && <span className={styles.bestBadge}>Menor preço atual</span>}
                        {!offer.valid && offer.collected_at && <span className={styles.staleBadge}>Coleta desatualizada</span>}
                        {!offer.collected_at && <span className={styles.freshnessNote}>Sem data de coleta</span>}
                      </div>
                      <small className={styles.collectionDate}>{offer.collected_at ? `Coletado em ${date(offer.collected_at)}` : offer.verified ? 'Confirmação do dado: usuário' : 'Data não informada'}</small>
                    </td>
                  })}
                  <td className={styles.differenceCell}>{difference === null ? '—' : <><strong>{money(difference)}</strong><small>entre os valores</small></>}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
          <div className={styles.tableFooter}><span><i className={styles.footerDot} /> Preços mais recentes por mercado</span><span>Atualizados pelo catálogo CompraFácil</span></div>
        </div>
        <p className={styles.disclaimer}>“Verificado” confirma os dados informados; não substitui uma data de coleta. Preços sem data ficam fora do ranking de preço atual. Confirme o valor na loja antes de comprar.</p>
      </>}
    </section>
    <footer className={styles.footer}><Link href="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true">C</span><span>compra<span>fácil</span></span></Link><span>Mais clareza para a sua próxima compra. <b>Rio Branco, AC</b></span></footer>
  </main>
}
