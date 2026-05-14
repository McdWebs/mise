import { useState } from 'react'

const STORAGE_KEY = 'mise-platform-currency'

export function usePlatformCurrency() {
  const [currency, setCurrencyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'ILS'
  )

  function setCurrency(c: string) {
    setCurrencyState(c)
    localStorage.setItem(STORAGE_KEY, c)
  }

  return { currency, setCurrency }
}

export function getPlatformCurrency(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'ILS'
}
