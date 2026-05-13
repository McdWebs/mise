import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { OrderStage } from '@mise/types'
import { formatPriceExact } from '../utils/formatPrice'
import type { TableOrder } from '../hooks/useTableOrders'

const STAGE_BADGE: Record<OrderStage, { label: string; color: string }> = {
  received: { label: 'Received', color: 'bg-paper-3 text-ink-5' },
  cooking: { label: 'Cooking', color: 'bg-saffron-wash text-saffron-3' },
  ready: { label: 'Ready', color: 'bg-herb-wash text-herb' },
  picked_up: { label: 'Picked up', color: 'bg-paper-3 text-ink-5' },
  cancelled: { label: 'Cancelled', color: 'bg-ember-wash text-ember' },
}

interface TableOrdersSheetProps {
  slug: string
  tableLabel: string
  currency: string
  orders: TableOrder[]
  onClose: () => void
}

export function TableOrdersSheet({ slug, tableLabel, currency, orders, onClose }: TableOrdersSheetProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [handleClose])

  const tableQ = encodeURIComponent(tableLabel)

  return (
    <div
      className="fixed inset-0 z-[12] flex items-end justify-center"
      style={{
        background: 'rgba(26,22,18,0.4)',
        opacity: open ? 1 : 0,
        transition: 'opacity 240ms ease',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[420px] bg-paper rounded-t-[16px] px-5 pb-6 pt-2 max-h-[85dvh] overflow-y-auto"
        style={{
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.2,0.8,0.2,1)',
          willChange: 'transform',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Your orders"
      >
        <div className="w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3.5" />

        <h2 className="font-display text-[22px] font-[500] tracking-[-0.01em] text-ink font-optical">
          Your orders today
        </h2>
        <p className="text-[14px] text-ink-5 mt-1 mb-4">{tableLabel}</p>

        {orders.length === 0 ? (
          <p className="text-[15px] text-ink-5 py-6 text-center leading-relaxed">
            No orders yet. Add items from the menu and send them from your cart.
          </p>
        ) : (
          <ul className="space-y-2 pb-1">
            {orders.map(order => {
              const badge = STAGE_BADGE[order.stage]
              const time = new Date(order.created_at).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })
              return (
                <li key={order.id}>
                  <Link
                    to={`/r/${slug}/order/${order.id}?table=${tableQ}`}
                    className="flex items-center gap-3 w-full rounded-2 border border-paper-3 bg-paper px-3.5 py-3 hover:bg-paper-2 transition-colors duration-hover"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[12px] text-ink-6 tabular-nums">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-5 mt-0.5">
                        {time}
                        {order.items.length > 0 && (
                          <span className="text-ink-6">
                            {' · '}
                            {order.items[0].itemName}
                            {order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="font-mono text-[13px] font-semibold text-ink tabular-nums shrink-0">
                      {formatPriceExact(order.subtotal_cents, currency)}
                    </span>
                    <ChevronRight size={18} className="text-ink-5 shrink-0" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
