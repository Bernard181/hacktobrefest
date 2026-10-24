/** Parse a decimal currency string into integer cents without floating point. */
export function parsePriceCents(input: string): number | null {
  const value = input.trim()
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value)
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(whole) || whole < 0) return null
  const cents = whole * 100 + fraction
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}
