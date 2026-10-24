import { describe, expect, it } from 'vitest'
import { priceDifferenceCents } from './comparison'

describe('UT-17 — comparação nominal de ofertas', () => {
  it('mostra diferença entre preços mesmo quando as datas não foram verificadas', () => {
    expect(priceDifferenceCents([
      { price_cents: 2799 },
      { price_cents: 2349 },
    ])).toBe(450)
  })

  it('não calcula diferença quando só há uma oferta', () => {
    expect(priceDifferenceCents([{ price_cents: 2799 }])).toBeNull()
  })
})
