import { describe, expect, it } from 'vitest'
import { formatPrice, isPriceValid, rankPrices } from './prices'

const NOW = new Date('2026-10-24T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString().slice(0, 10)

describe('validade e ranking', () => {
  it('UT-01 aceita 29 dias', () => expect(isPriceValid({ collected_at: daysAgo(29) }, NOW)).toBe(true))
  it('UT-02 aceita exatamente 30 dias', () => expect(isPriceValid({ collected_at: daysAgo(30) }, NOW)).toBe(true))
  it('UT-03 rejeita 31 dias', () => expect(isPriceValid({ collected_at: daysAgo(31) }, NOW)).toBe(false))
  it('UT-04 remove vencidos do ranking, mantendo-os visíveis', () => {
    const ranked = rankPrices([{ id: 'old', price_cents: 100, collected_at: daysAgo(31) }, { id: 'fresh', price_cents: 200, collected_at: daysAgo(1) }], NOW)
    expect(ranked.map((price) => [price.id, price.valid, price.ranked])).toEqual([['fresh', true, true], ['old', false, false]])
  })
  it('UT-05 sinaliza o vencido', () => expect(rankPrices([{ price_cents: 100, collected_at: daysAgo(31) }], NOW)[0].valid).toBe(false))
  it('UT-06 desempata pela coleta mais recente', () => {
    const ranked = rankPrices([{ id: 'older', price_cents: 1990, collected_at: '2026-10-20' }, { id: 'newer', price_cents: 1990, collected_at: '2026-10-22' }], NOW)
    expect(ranked.map((price) => price.id)).toEqual(['newer', 'older'])
  })
  it('UT-07 formata centavos em pt-BR', () => expect(formatPrice(2890)).toBe('R$ 28,90'))
  it('UT-08 ordena por centavos inteiros sem arredondamento', () => {
    const ranked = rankPrices([{ price_cents: 101, collected_at: '2026-10-24' }, { price_cents: 100, collected_at: '2026-10-24' }], NOW)
    expect(ranked.map((price) => price.price_cents)).toEqual([100, 101])
  })
  it('UT-09 identifica coleta futura como inválida', () => expect(isPriceValid({ collected_at: '2026-10-25' }, NOW)).toBe(false))
  it('UT-16 mantém visível o preço sem coleta e o exclui da validade e ranking', () => {
    expect(rankPrices([{ id: 'undated', price_cents: 10, collected_at: null }], NOW)).toEqual([
      { id: 'undated', price_cents: 10, collected_at: null, valid: false, ranked: false },
    ])
  })
})
