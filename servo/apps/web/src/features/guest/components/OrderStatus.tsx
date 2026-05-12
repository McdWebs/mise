import { useState } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import type { Order, OrderItem } from '@servo/types'
import type { OrderStage } from '@servo/types'
import { formatPriceExact } from '../utils/formatPrice'
import { supabase } from '@/lib/supabase'

interface OrderStatusProps {
  order: Order
  items: (OrderItem & { itemName: string })[]
  tableLabel: string
}

const STAGE_STEPS: { stage: OrderStage; label: string }[] = [
  { stage: 'received', label: 'Received' },
  { stage: 'cooking',  label: 'Cooking' },
  { stage: 'ready',    label: 'Ready' },
]

const STAGE_HEADLINE: Partial<Record<OrderStage, string>> = {
  received:  'Order received',
  cooking:   'Cooking now',
  ready:     'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Order cancelled',
}

export function OrderStatus({ order, items, tableLabel }: OrderStatusProps) {
  const [helpSent, setHelpSent] = useState(false)
  const [helpLoading, setHelpLoading] = useState(false)

  const currentIdx = STAGE_STEPS.findIndex(s => s.stage === order.stage)

  async function callServer() {
    setHelpLoading(true)
    try {
      await supabase.from('assistance_requests').insert({
        restaurant_id: order.restaurant_id,
        table_label: tableLabel,
        kind: 'call_server',
        status: 'open',
      })
      setHelpSent(true)
    } catch {
      // silently fail — guest sees no error
    } finally {
      setHelpLoading(false)
    }
  }

  const isCancelled = order.stage === 'cancelled'

  return (
    <div
      className="min-h-dvh bg-paper px-5 py-6"
      style={{ backgroundImage: 'url(/assets/pattern-tablecloth.svg)', backgroundRepeat: 'repeat' }}
    >
      {/* Stage header */}
      <div className="text-center mb-8">
        <p className="text-overline text-ink-6 uppercase tracking-[0.08em] mb-2">
          Order sent · {tableLabel}
        </p>
        <h1 className="font-display text-[32px] font-[500] tracking-[-0.02em] text-ink font-optical">
          {STAGE_HEADLINE[order.stage] ?? order.stage}
        </h1>
        <p className="font-mono text-[12px] text-ink-6 mt-1 tabular-nums">
          #{order.id.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Progress track — only for non-cancelled */}
      {!isCancelled && (
        <>
          <div className="flex items-center gap-2 mb-0">
            {STAGE_STEPS.map((step, idx) => (
              <div
                key={step.stage}
                className="flex-1 h-1 rounded-pill transition-colors duration-standard"
                style={{
                  background:
                    idx < currentIdx
                      ? 'var(--ink-3)'       // done — dark grey
                      : idx === currentIdx
                      ? 'var(--saffron)'     // active — saffron
                      : 'var(--paper-3)',    // pending — light
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-[-14px] mb-8 px-1">
            {STAGE_STEPS.map((step, idx) => (
              <span
                key={step.stage}
                className="text-[11px] font-medium"
                style={{
                  color: idx === currentIdx ? 'var(--saffron-3)' : 'var(--ink-6)',
                  fontWeight: idx === currentIdx ? 700 : 500,
                }}
              >
                {step.label}
              </span>
            ))}
          </div>
        </>
      )}

      {isCancelled && (
        <div className="mb-6 p-4 bg-ember-wash border border-ember/30 rounded-3 text-center">
          <p className="text-[14px] text-ember font-medium">
            This order was cancelled. Please speak to a server if you need help.
          </p>
        </div>
      )}

      {/* Order recap */}
      <div className="bg-paper rounded-3 border border-paper-3 mb-5">
        <div className="divide-y divide-paper-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 px-4 py-3">
              <span className="font-mono font-semibold text-ink-6 w-6 tabular-nums text-[14px]">
                {item.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-ink">{item.itemName}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-[12px] text-ink-6 mt-0.5">{item.modifiers.join(', ')}</p>
                )}
              </div>
              <span className="font-mono text-[14px] font-semibold text-ink tabular-nums">
                {formatPriceExact(item.unit_price_cents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Call server */}
      <div className="flex gap-3 items-center p-4 bg-paper border border-paper-3 rounded-3">
        <div className="w-10 h-10 rounded-full bg-paper-2 flex items-center justify-center text-ink shrink-0">
          {helpSent ? <CheckCircle2 size={20} className="text-herb" /> : <Bell size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-[17px] font-[500] text-ink font-optical">
            {helpSent ? 'Help is on the way' : 'Need something from the floor?'}
          </h4>
          <p className="text-[13px] text-ink-5 mt-0.5">
            {helpSent
              ? 'A server will be over shortly.'
              : 'Tap to ask a server to come to your table.'}
          </p>
        </div>
        {!helpSent && (
          <button
            onClick={callServer}
            disabled={helpLoading}
            className="shrink-0 h-[38px] px-3.5 rounded-[10px] border border-[1.5px] border-paper-4 bg-transparent text-ink text-[13px] font-semibold hover:bg-paper-2 transition-colors duration-hover disabled:opacity-50 flex items-center gap-1.5"
          >
            {helpLoading && <Loader2 size={12} className="animate-spin" />}
            Call
          </button>
        )}
      </div>
    </div>
  )
}
