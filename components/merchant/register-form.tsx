'use client'

import { useState } from 'react'
import { registerMerchantAction } from '../../app/(merchant)/cadastro/lojista/actions'
import styles from './merchant.module.css'

type MarketOption = { id: string; name: string; address: string | null; city: string; state: string }

export default function RegisterForm({ markets }: { markets: MarketOption[] }) {
  const [marketId, setMarketId] = useState('')
  const market = markets.find((item) => item.id === marketId)
  return <form action={registerMerchantAction} className={styles.form}>
    <label>Mercado
      <select name="market_id" required value={marketId} onChange={(event) => setMarketId(event.target.value)}>
        <option value="" disabled>Selecione um mercado</option>
        {markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {market && <div className={styles.marketLocation} aria-live="polite">
      <strong>Localização cadastrada</strong>
      <span>{market.city}/{market.state}</span>
      {market.address && <span>{market.address}</span>}
      {!market.address && <span>Endereço ainda não informado.</span>}
    </div>}
    <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /><small>Use pelo menos 8 caracteres.</small></label>
    <button type="submit">Criar conta de lojista</button>
  </form>
}
