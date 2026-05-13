const SYMBOLS: Record<string, string> = {
  USD: '$',    EUR: '€',    GBP: '£',    CAD: '$',
  AUD: '$',    NZD: '$',    SGD: 'S$',   HKD: 'HK$',
  ILS: '₪',   JPY: '¥',    CHF: 'Fr. ', NOK: 'kr ',
  SEK: 'kr ',  DKK: 'kr ',  MXN: '$',    BRL: 'R$',
  INR: '₹',   ZAR: 'R',    AED: 'د.إ ', THB: '฿',
}

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? `${code} `
}

/** Short format — omits decimals when price is a whole number. */
export function formatPrice(cents: number, currency = 'USD'): string {
  const sym = currencySymbol(currency)
  const amount = cents / 100
  if (cents % 100 === 0) return `${sym}${amount.toFixed(0)}`
  return `${sym}${amount.toFixed(2)}`
}

/** Always show two decimal places — for totals and receipts. */
export function formatPriceExact(cents: number, currency = 'USD'): string {
  return `${currencySymbol(currency)}${(cents / 100).toFixed(2)}`
}
