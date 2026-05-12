/** Format price_cents → display string. currency is the restaurant.currency field (e.g. "CAD"). */
export function formatPrice(cents: number, _currency = 'CAD'): string {
  const dollars = cents / 100
  // Show decimals only when non-zero
  if (cents % 100 === 0) return `$${dollars.toFixed(0)}`
  return `$${dollars.toFixed(2)}`
}

/** Always show two decimal places — for totals/receipts. */
export function formatPriceExact(cents: number, _currency = 'CAD'): string {
  return `$${(cents / 100).toFixed(2)}`
}
