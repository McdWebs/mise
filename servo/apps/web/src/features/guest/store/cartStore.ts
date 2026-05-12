import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartMenuLine {
  kind: 'menu'
  menuItemId: string
  name: string
  unitPriceCents: number
  quantity: number
  modifiers: string[]
}

export interface CartPlanLine {
  kind: 'plan'
  planId: string
  name: string
  unitPriceCents: number
  quantity: number
  /** Snapshot of plan includes for cart + order modifiers */
  detailLines: string[]
  modifiers: string[]
}

export type CartLine = CartMenuLine | CartPlanLine

/** Input for addLine (Omit<CartLine,'quantity'> is wrong for unions in TypeScript) */
export type CartLineInput =
  | (Omit<CartMenuLine, 'quantity'> & { quantity?: number })
  | (Omit<CartPlanLine, 'quantity'> & { quantity?: number })

export function cartLineKey(line: CartLine): string {
  if (line.kind === 'plan') return `plan:${line.planId}`
  return `menu:${line.menuItemId}:${JSON.stringify(line.modifiers)}`
}

interface CartState {
  lines: Record<string, CartLine[]>
  addLine: (restaurantId: string, line: CartLineInput) => void
  removeLine: (restaurantId: string, lineKey: string) => void
  updateQuantity: (restaurantId: string, lineKey: string, quantity: number) => void
  clearCart: (restaurantId: string) => void
  getLines: (restaurantId: string) => CartLine[]
  getTotalCents: (restaurantId: string) => number
  getTotalItems: (restaurantId: string) => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: {},

      addLine(restaurantId, line) {
        const key = cartLineKey({ ...line, quantity: line.quantity ?? 1 } as CartLine)
        set(state => {
          const existing = state.lines[restaurantId] ?? []
          const idx = existing.findIndex(l => cartLineKey(l) === key)
          if (idx >= 0) {
            const updated = existing.slice()
            updated[idx] = {
              ...updated[idx],
              quantity: updated[idx].quantity + (line.quantity ?? 1),
            }
            return { lines: { ...state.lines, [restaurantId]: updated } }
          }
          return {
            lines: {
              ...state.lines,
              [restaurantId]: [...existing, { ...line, quantity: line.quantity ?? 1 } as CartLine],
            },
          }
        })
      },

      removeLine(restaurantId, lineKey) {
        set(state => ({
          lines: {
            ...state.lines,
            [restaurantId]: (state.lines[restaurantId] ?? []).filter(
              l => cartLineKey(l) !== lineKey
            ),
          },
        }))
      },

      updateQuantity(restaurantId, lineKey, quantity) {
        if (quantity <= 0) {
          get().removeLine(restaurantId, lineKey)
          return
        }
        set(state => ({
          lines: {
            ...state.lines,
            [restaurantId]: (state.lines[restaurantId] ?? []).map(l =>
              cartLineKey(l) === lineKey ? { ...l, quantity } : l
            ),
          },
        }))
      },

      clearCart(restaurantId) {
        set(state => ({ lines: { ...state.lines, [restaurantId]: [] } }))
      },

      getLines(restaurantId) {
        return get().lines[restaurantId] ?? []
      },

      getTotalCents(restaurantId) {
        return (get().lines[restaurantId] ?? []).reduce(
          (sum, l) => sum + l.unitPriceCents * l.quantity,
          0
        )
      },

      getTotalItems(restaurantId) {
        return (get().lines[restaurantId] ?? []).reduce((sum, l) => sum + l.quantity, 0)
      },
    }),
    {
      name: 'servo-cart',
      version: 1,
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion >= 1 || !persisted || typeof persisted !== 'object') return persisted
        const p = persisted as { state?: { lines?: Record<string, unknown[]> } }
        const lines = p.state?.lines
        if (!lines) return persisted
        for (const rid of Object.keys(lines)) {
          const arr = lines[rid]
          if (!Array.isArray(arr)) continue
          lines[rid] = arr.map(entry => {
            if (!entry || typeof entry !== 'object') return entry
            const e = entry as Record<string, unknown>
            if (e.kind === 'menu' || e.kind === 'plan') return entry
            return {
              kind: 'menu' as const,
              menuItemId: e.menuItemId as string,
              name: e.name as string,
              unitPriceCents: e.unitPriceCents as number,
              quantity: e.quantity as number,
              modifiers: (e.modifiers as string[]) ?? [],
            }
          })
        }
        return persisted
      },
    }
  )
)
