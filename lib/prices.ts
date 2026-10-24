export type DatedPrice = { collected_at: string | null }

export function isPriceValid(price: DatedPrice, now: Date): boolean {
  if (!price.collected_at) return false
  const date = parseDate(price.collected_at)
  if (!date) return false
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const collected = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const age = (today - collected) / 86_400_000
  return age >= 0 && age <= 30
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export function rankPrices<T extends DatedPrice & { price_cents: number }>(prices: T[], now: Date): (T & { valid: boolean; ranked: boolean })[] {
  return prices.map((price) => {
    const valid = isPriceValid(price, now)
    return { ...price, valid, ranked: valid }
  })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1
      if (a.ranked && b.ranked) {
        if (a.price_cents !== b.price_cents) return a.price_cents - b.price_cents
        return (b.collected_at ?? '').localeCompare(a.collected_at ?? '')
      }
      if (a.collected_at === null) return b.collected_at === null ? 0 : 1
      if (b.collected_at === null) return -1
      return b.collected_at.localeCompare(a.collected_at)
    })
}

export function formatPrice(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new TypeError('O preço deve ser um inteiro seguro em centavos')
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100).replace(/[\u00a0\u202f]/g, ' ')
}
