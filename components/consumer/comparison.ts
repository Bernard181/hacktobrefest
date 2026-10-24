export function priceDifferenceCents(offers: { price_cents: number }[]): number | null {
  const prices = offers.map((offer) => offer.price_cents).filter(Number.isSafeInteger)
  if (prices.length < 2) return null
  return Math.max(...prices) - Math.min(...prices)
}
