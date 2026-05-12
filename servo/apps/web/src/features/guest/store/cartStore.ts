import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartLine {
  menuItemId: string
  name: string
  unitPriceCents: number
  quantity: number
  modifiers: string[]
}

interface CartState {
  // Keyed by restaurantId so multi-tenant browsing never collides
  lines: Record<string, CartLine[]>
  addLine: (restaurantId: string, line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void
  removeLine: (restaurantId: string, menuItemId: string) => void
  updateQuantity: (restaurantId: string, menuItemId: string, quantity: number) => void
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
        set(state => {
          const existing = state.lines[restaurantId] ?? []
          const idx = existing.findIndex(
            l => l.menuItemId === line.menuItemId &&
                 JSON.stringify(l.modifiers) === JSON.stringify(line.modifiers)
          )
          if (idx >= 0) {
            const updated = existing.slice()
            updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + (line.quantity ?? 1) }
            return { lines: { ...state.lines, [restaurantId]: updated } }
          }
          return {
            lines: {
              ...state.lines,
              [restaurantId]: [...existing, { ...line, quantity: line.quantity ?? 1 }],
            },
          }
        })
      },

      removeLine(restaurantId, menuItemId) {
        set(state => ({
          lines: {
            ...state.lines,
            [restaurantId]: (state.lines[restaurantId] ?? []).filter(l => l.menuItemId !== menuItemId),
          },
        }))
      },

      updateQuantity(restaurantId, menuItemId, quantity) {
        if (quantity <= 0) {
          get().removeLine(restaurantId, menuItemId)
          return
        }
        set(state => ({
          lines: {
            ...state.lines,
            [restaurantId]: (state.lines[restaurantId] ?? []).map(l =>
              l.menuItemId === menuItemId ? { ...l, quantity } : l
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
    { name: 'servo-cart' }
  )
)
