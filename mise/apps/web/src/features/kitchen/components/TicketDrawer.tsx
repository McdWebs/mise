import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { KitchenOrder } from '../hooks/useKitchenOrders'
import type { OrderStage } from '@mise/types'

const NEXT_STAGE: Partial<Record<OrderStage, OrderStage>> = {
  received: 'cooking',
  cooking:  'ready',
  ready:    'picked_up',
}

const ADVANCE_LABEL: Partial<Record<OrderStage, string>> = {
  received: 'Start cooking',
  cooking:  'Mark ready',
  ready:    'Mark picked up',
}

interface TicketDrawerProps {
  order: KitchenOrder | null
  onClose: () => void
  applyOrderStage: (orderId: string, stage: OrderStage) => void
  restoreKitchenOrder: (order: KitchenOrder) => void
}

export function TicketDrawer({ order, onClose, applyOrderStage, restoreKitchenOrder }: TicketDrawerProps) {
  const [saving, setSaving] = useState(false)
  const open = order !== null

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function advance() {
    if (!order) return
    const next = NEXT_STAGE[order.stage as OrderStage]
    if (!next) return
    const prevStage = order.stage as OrderStage
    setSaving(true)
    applyOrderStage(order.id, next)
    const { error } = await supabase.from('orders').update({ stage: next }).eq('id', order.id)
    setSaving(false)
    if (error) {
      applyOrderStage(order.id, prevStage)
      return
    }
    onClose()
  }

  async function cancel() {
    if (!order) return
    const snapshot = { ...order }
    setSaving(true)
    applyOrderStage(order.id, 'cancelled')
    const { error } = await supabase.from('orders').update({ stage: 'cancelled' }).eq('id', order.id)
    setSaving(false)
    if (error) {
      restoreKitchenOrder(snapshot)
      return
    }
    onClose()
  }

  const nextLabel = order ? ADVANCE_LABEL[order.stage as OrderStage] : null
  const subtotalFmt = order
    ? `$${(order.subtotal_cents / 100).toFixed(2)}`
    : ''

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/60 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-paper flex flex-col shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-paper-3">
          <div>
            <p className="font-mono text-mono text-ink font-semibold uppercase">
              {order?.table_label ?? '—'}
            </p>
            <p className="font-mono text-[10px] text-ink-5 tracking-widest mt-0.5">
              #{order?.id.slice(-4).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-2 text-ink-6 hover:text-ink hover:bg-paper-2 transition-colors duration-hover"
          >
            <X size={16} />
          </button>
        </div>

        {/* Order items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {order?.order_items.map(item => {
            const plan = Boolean(item.restaurant_plan_id)
            const title = item.restaurant_plans?.title ?? item.menu_items?.name ?? '—'
            const detailLines =
              plan && item.restaurant_plans?.includes?.length
                ? item.restaurant_plans.includes
                : item.modifiers ?? []
            return (
              <div key={item.id}>
                <div className="flex gap-2">
                  <span className="font-mono text-[11px] text-ink-6 shrink-0 mt-0.5">
                    {item.quantity}×
                  </span>
                  <div className="min-w-0">
                    <p className="text-body text-ink font-medium">
                      {title}
                      {plan && (
                        <span className="ml-2 text-overline text-saffron tracking-widest">plan</span>
                      )}
                    </p>
                    {detailLines.length > 0 && (
                      <div className="mt-1.5 px-2 py-1.5 bg-ember-wash rounded-1 space-y-0.5">
                        {detailLines.map((mod, i) => (
                          <p key={i} className="text-body-sm text-ember">
                            {mod}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Subtotal */}
        <div className="px-4 py-3 border-t border-paper-3 flex justify-between items-center">
          <span className="text-body-sm text-ink-6">Subtotal</span>
          <span className="font-mono text-mono text-ink">{subtotalFmt}</span>
        </div>

        {/* Actions */}
        <div className="px-4 pb-6 pt-2 space-y-2">
          {nextLabel && (
            <button
              onClick={advance}
              disabled={saving}
              className="w-full h-11 rounded-2 bg-ink text-paper text-body font-semibold transition-opacity duration-hover disabled:opacity-50 active:scale-[0.98] active:duration-press"
            >
              {nextLabel}
            </button>
          )}
          {order?.stage !== 'cancelled' && order?.stage !== 'picked_up' && (
            <button
              onClick={cancel}
              disabled={saving}
              className="w-full h-11 rounded-2 border border-ember text-ember text-body font-medium transition-opacity duration-hover disabled:opacity-50 active:scale-[0.98] active:duration-press"
            >
              Cancel order
            </button>
          )}
        </div>
      </div>
    </>
  )
}
