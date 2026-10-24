'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { logoutAction } from '../../app/(merchant)/dashboard/actions'
import styles from './merchant.module.css'
import { parsePriceCents } from './price-input'

type Offer = { id: string; market?: { name: string }; product?: { id: string; name: string; brand: string; unit: string }; product_id?: string; value_cents?: number; price_cents?: number; collected_at: string | null; valid?: boolean; ranked?: boolean }
type Product = { id: string; name: string; brand: string; unit: string }

export default function MerchantDashboard({ marketName }: { marketName: string }) {
  const [offers, setOffers] = useState<Offer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  async function load() {
    setError('')
    try {
      const [pricesRes, productsRes] = await Promise.all([fetch('/api/merchant/prices', { cache: 'no-store' }), fetch('/api/v1/products', { cache: 'no-store' })])
      if (pricesRes.status === 401 || pricesRes.status === 403) { router.replace('/login'); return }
      if (!pricesRes.ok) throw new Error('Não foi possível carregar as ofertas.')
      const priceData = await pricesRes.json()
      setOffers(priceData.items || [])
      if (productsRes.ok) { const productData = await productsRes.json(); setProducts(productData.items || []) }
    } catch { setError('Falha ao carregar dados. Tente novamente.') }
  }
  useEffect(() => { void load() }, [])
  async function submit(formData: FormData) {
    setBusy(true); setError('')
    const valueCents = parsePriceCents(String(formData.get('price') || ''))
    const collectedAt = String(formData.get('collected_at') || '')
    if (valueCents === null) { setError('Informe um preço positivo com no máximo duas casas decimais (ex.: 27,99).'); setBusy(false); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) { setError('Informe uma data de coleta válida.'); setBusy(false); return }
    try {
      const response = await fetch('/api/merchant/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: formData.get('product_id'), value_cents: valueCents, collected_at: collectedAt }) })
      if (!response.ok) throw new Error('Não foi possível salvar. Confira o produto e a data.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar preço.') }
    finally { setBusy(false) }
  }
  return <section className={styles.shell}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Painel do lojista</p><h1 className={styles.title}>{marketName}</h1><p className={styles.muted}>Gerencie somente as ofertas vinculadas a este mercado.</p></div>
      <form action={logoutAction}><button className={styles.secondary}>Sair</button></form></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}><section className={styles.card}><h2>Atualizar preço</h2><form action={submit} className={styles.form}>
      <label>Produto<select name="product_id" required defaultValue=""><option value="" disabled>Selecione um produto</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.brand ? ` — ${product.brand}` : ''} ({product.unit})</option>)}</select></label>
      <label>Preço (R$)<input name="price" inputMode="decimal" placeholder="0,00" required /></label>
      <label>Data da coleta<input name="collected_at" type="date" required /></label>
      <button disabled={busy}>{busy ? 'Salvando…' : 'Salvar novo preço'}</button>
      <small>Cada atualização registra um novo preço e preserva o histórico.</small>
    </form></section>
    <section className={styles.card}><h2>Ofertas cadastradas</h2>{offers.length === 0 ? <p>Nenhuma oferta cadastrada ainda.</p> : <ul className={styles.offers}>{offers.map((offer, index) => <li key={offer.id || index}><strong>{offer.product?.name || offer.product_id || 'Produto'}</strong><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((offer.value_cents ?? offer.price_cents ?? 0) / 100)}</span><small>{offer.collected_at || 'Data não informada'}</small></li>)}</ul>}</section></div>
  </section>
}
