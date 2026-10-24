'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './consumer.module.css'

type Product = { id: string; name: string; brand: string; category: string; unit: string; image_url: string | null }
type Market = { id: string; name: string; address: string | null; neighborhood: string | null; city: string; state: string; demo: boolean }
type Offer = { id: string; market: Market; price_cents: number; collected_at: string | null; verified: boolean; valid: boolean; ranked: boolean; source: 'painel' | 'api' | 'seed' }
type PriceResponse = { product: Product; offers: Offer[] }

const PAGE_SIZE = 6
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Data não informada'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const marketLocation = (market: Market) => market.address
  ? [market.address, market.neighborhood, market.city, market.state].filter(Boolean).join(' · ')
  : [market.city, market.state].filter(Boolean).join(', ')

export function ConsumerSearch() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [catalog, setCatalog] = useState<Product[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function loadCatalog() {
      setLoading(true)
      setCatalogError('')
      try {
        const [productResponse, marketResponse] = await Promise.all([
          fetch('/api/v1/products', { signal: controller.signal }),
          fetch('/api/v1/markets?state=AC', { signal: controller.signal }),
        ])
        if (!productResponse.ok || !marketResponse.ok) throw new Error('Não foi possível carregar o catálogo. Tente novamente.')
        const productData = await productResponse.json() as { items: Product[] }
        const marketData = await marketResponse.json() as { items: Market[] }
        setCatalog(productData.items)
        setMarkets(marketData.items)
      } catch (cause) {
        if (controller.signal.aborted) return
        setCatalogError(cause instanceof Error ? cause.message : 'Ocorreu um erro ao carregar o catálogo.')
        setCatalog([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void loadCatalog()
    return () => controller.abort()
  }, [])

  const categories = useMemo(() => [...new Set(catalog.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [catalog])
  const filteredProducts = useMemo(() => {
    const term = normalize(query.trim())
    return catalog.filter(product => (!category || product.category.toLocaleLowerCase('pt-BR') === category.toLocaleLowerCase('pt-BR')) &&
      (!term || normalize(`${product.name} ${product.brand}`).includes(term)))
  }, [catalog, query, category])
  const pageCount = Math.ceil(filteredProducts.length / PAGE_SIZE)
  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedProduct = catalog.find(product => product.id === selectedId) ?? null
  const cheapest = Math.min(...offers.filter(offer => offer.ranked).map(offer => offer.price_cents), Number.POSITIVE_INFINITY)
  const rankedPrices = offers.filter(offer => offer.ranked).map(offer => offer.price_cents)
  const difference = rankedPrices.length < 2 ? null : Math.max(...rankedPrices) - Math.min(...rankedPrices)
  const verifiedCount = offers.filter(offer => offer.verified).length

  useEffect(() => { setPage(1); setSelectedId(null) }, [query, category])

  useEffect(() => {
    if (!selectedId) { setOffers([]); setOffersError(''); setOffersLoading(false); return }
    const controller = new AbortController()
    async function loadOffers() {
      setOffersLoading(true)
      setOffersError('')
      setOffers([])
      try {
        const response = await fetch(`/api/v1/prices?product_id=${encodeURIComponent(selectedId!)}&state=AC`, { signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível carregar os preços. Tente novamente.')
        const data = await response.json() as PriceResponse
        setOffers(data.offers)
      } catch (cause) {
        if (controller.signal.aborted) return
        setOffersError(cause instanceof Error ? cause.message : 'Ocorreu um erro ao carregar os preços.')
      } finally {
        if (!controller.signal.aborted) setOffersLoading(false)
      }
    }
    void loadOffers()
    return () => controller.abort()
  }, [selectedId])

  return <main className={styles.page}>
    <nav className={styles.nav} aria-label="Navegação principal">
      <Link href="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true">C</span><span>compra<span>fácil</span></span></Link>
      <div className={styles.navRight}><span className={styles.location}><span aria-hidden="true">⌖</span> Acre, AC</span><Link href="/login" className={styles.merchantLink}>Área do lojista <span aria-hidden="true">↗</span></Link></div>
    </nav>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}><span className={styles.liveDot} /> COMPRAS MAIS INTELIGENTES, TODO DIA</span>
        <h1>Seu dinheiro<br />vale <em>mais.</em></h1>
        <p>Compare os valores informados dos itens essenciais nos mercados cadastrados no Acre e veja quando cada preço foi coletado.</p>
        <a href="#comparacao" className={styles.heroButton}>Comparar valores <span aria-hidden="true">↓</span></a>
      </div>
      <div className={styles.heroVisual} aria-hidden="true">
        <div className={`${styles.orbit} ${styles.orbitOne}`} /><div className={`${styles.orbit} ${styles.orbitTwo}`} />
        <div className={styles.receipt}><span className={styles.receiptLabel}>COLETA · 24/10/2026</span><div className={styles.receiptLine}><span>Arroz 5 kg</span><strong>R$ 23,49</strong></div><div className={styles.receiptLine}><span>Café 250 g</span><strong>R$ 12,49</strong></div><div className={styles.receiptLine}><span>Açúcar 1 kg</span><strong>R$ 2,49</strong></div><div className={styles.receiptTotal}><span>COMPARE COM CLAREZA</span><b>↘</b></div></div>
        <span className={styles.heroSparkle}>✳</span><span className={styles.heroBadge}>Preço a preço,<br />você decide.</span>
      </div>
      <div className={styles.heroBottom}><span>01 — COMPARE</span><span>02 — ESCOLHA</span><span>03 — ECONOMIZE</span></div>
    </section>

    <section className={styles.searchSection} id="comparacao" aria-label="Busca e comparação de preços">
      <div className={styles.sectionHeading}>
        <div><span className={styles.sectionKicker}>PESQUISA DE PREÇOS</span><h2>O que vai na sua lista?</h2><p>Escolha um produto para comparar preços nos mercados do Acre.</p></div>
        <span className={styles.productCount}>{filteredProducts.length.toString().padStart(2, '0')} <small>produtos</small></span>
      </div>

      <div className={styles.searchCard}>
        <label className={styles.searchField}><span className={styles.fieldIcon} aria-hidden="true">⌕</span><span className={styles.srOnly}>Buscar produto</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Busque por produto ou marca…" type="search" /></label>
        <label className={styles.categoryField}><span className={styles.srOnly}>Categoria</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select><span className={styles.selectChevron} aria-hidden="true">⌄</span></label>
        <span className={styles.searchHint}><kbd>⌕</kbd> Busque arroz, café, feijão…</span>
      </div>

      <div className={styles.trustNote}><span className={styles.trustIcon} aria-hidden="true">✓</span><span><strong>Informação clara, escolha sua.</strong> Os preços-base foram informados pelo usuário, com coleta em 24/10/2026. A cobertura da consulta é estadual; cidade e endereço aparecem somente quando cadastrados.</span></div>

      {loading && <div className={styles.stateCard} role="status" aria-live="polite"><span className={styles.spinner} /> Carregando catálogo…</div>}
      {!loading && catalogError && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><strong>Não conseguimos carregar os produtos.</strong><span>{catalogError}</span></div>}
      {!loading && !catalogError && filteredProducts.length === 0 && <div className={styles.stateCard} role="status"><strong>Nenhum produto encontrado.</strong><span>Tente outro nome ou escolha uma categoria diferente.</span></div>}

      {!loading && !catalogError && filteredProducts.length > 0 && <>
        <div className={styles.resultsBar}><div><span className={styles.sectionKicker}>SELEÇÃO DE PRODUTOS</span><h3>Escolha um produto</h3></div><span className={styles.resultsMeta}>{filteredProducts.length} produtos · {pageCount} {pageCount === 1 ? 'página' : 'páginas'}</span></div>
        <div className={styles.productList} aria-label="Produtos disponíveis">
          {pageProducts.map(product => <button key={product.id} type="button" className={`${styles.productRow} ${selectedId === product.id ? styles.productRowSelected : ''}`} aria-pressed={selectedId === product.id} onClick={() => setSelectedId(product.id)}>
            <span className={styles.productImageWrap}><span className={styles.productImageFallback} aria-hidden="true">{product.name.slice(0, 1).toLocaleUpperCase('pt-BR')}</span>{product.image_url && <img className={styles.productImage} src={product.image_url} alt={product.name} loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}</span>
            <span className={styles.productRowInfo}><span className={styles.productCategory}>{product.category}</span><strong>{product.name}</strong><span>{product.brand} · {product.unit}</span></span>
            <span className={styles.productRowAction}>{selectedId === product.id ? 'Selecionado' : 'Comparar'} <span aria-hidden="true">→</span></span>
          </button>)}
        </div>
        {pageCount > 1 && <nav className={styles.pagination} aria-label="Paginação de produtos">
          <button type="button" className={styles.pageButton} onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>Anterior</button>
          <span aria-live="polite">Página {page} de {pageCount}</span>
          <button type="button" className={styles.pageButton} onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Próxima</button>
        </nav>}
      </>}

      {selectedProduct && <section className={styles.comparisonPanel} aria-label={`Comparação de preços: ${selectedProduct.name}`}>
        <div className={styles.resultsBar}><div><span className={styles.sectionKicker}>COMPARAÇÃO</span><h3>{selectedProduct.name} · {selectedProduct.unit}</h3></div><span className={styles.resultsMeta}>{verifiedCount} preços verificados</span></div>
        {offersLoading && <div className={styles.stateCard} role="status" aria-live="polite"><span className={styles.spinner} /> Carregando preços…</div>}
        {!offersLoading && offersError && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><strong>Não conseguimos carregar os preços.</strong><span>{offersError}</span></div>}
        {!offersLoading && !offersError && <div className={styles.tableFrame}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Comparação de {selectedProduct.name} por mercado no Acre</caption>
              <thead><tr><th scope="col" className={styles.productHeader}>PRODUTO</th>{markets.map(market => <th scope="col" key={market.id}>{market.name}{market.demo && <small className={styles.demoLabel}>Demonstração</small>}<small className={styles.marketAddress}>{marketLocation(market)}</small></th>)}<th scope="col" className={styles.differenceHeader}>DIFERENÇA</th></tr></thead>
              <tbody><tr>
                <th scope="row" className={styles.productCell}><span className={styles.productImageWrap}><span className={styles.productImageFallback} aria-hidden="true">{selectedProduct.name.slice(0, 1).toLocaleUpperCase('pt-BR')}</span>{selectedProduct.image_url && <img className={styles.productImage} src={selectedProduct.image_url} alt="" onError={event => { event.currentTarget.hidden = true }} />}</span><span><strong>{selectedProduct.name}</strong><small>{selectedProduct.brand} · {selectedProduct.unit}</small></span></th>
                {markets.map(market => {
                  const offer = offers.find(item => item.market.id === market.id)
                  if (!offer) return <td key={market.id}><span className={styles.noPrice}>Sem oferta cadastrada</span></td>
                  return <td key={market.id}>
                    <div className={styles.price}>{money(offer.price_cents)}</div>
                    <div className={styles.statusStack}>
                      {offer.verified && <span className={styles.verifiedBadge}><span>✓</span> Verificado</span>}
                      {offer.ranked && offer.price_cents === cheapest && <span className={styles.bestBadge}>Menor preço atual</span>}
                      {!offer.valid && offer.collected_at && <span className={styles.staleBadge}>Coleta desatualizada</span>}
                      {!offer.collected_at && <span className={styles.freshnessNote}>Sem data de coleta</span>}
                    </div>
                    <small className={styles.collectionDate}>{offer.collected_at ? `Coletado em ${date(offer.collected_at)}` : 'Data não informada'}</small>
                  </td>
                })}
                <td className={styles.differenceCell}>{difference === null ? '—' : <><strong>{money(difference)}</strong><small>entre os valores</small></>}</td>
              </tr></tbody>
            </table>
          </div>
          <div className={styles.tableFooter}><span><i className={styles.footerDot} /> Preços mais recentes por mercado</span><span>Atualizados pelo catálogo CompraFácil</span></div>
        </div>}
        <p className={styles.disclaimer}>“Verificado” confirma os dados informados; não substitui uma data de coleta. Preços sem data ficam fora do ranking de preço atual. Confirme o valor na loja antes de comprar.</p>
      </section>}
    </section>
    <footer className={styles.footer}><Link href="/" className={styles.brand}><span className={styles.brandMark} aria-hidden="true">C</span><span>compra<span>fácil</span></span></Link><span>Mais clareza para a sua próxima compra. <b>Acre, AC</b></span></footer>
  </main>
}
