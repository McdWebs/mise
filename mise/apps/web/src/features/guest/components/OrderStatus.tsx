import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCircle2, Loader2, PlusCircle } from 'lucide-react'
import type { Order, OrderItem } from '@mise/types'
import type { OrderStage } from '@mise/types'
import { formatPriceExact } from '../utils/formatPrice'
import { supabase } from '@/lib/supabase'
import { notifyKitchenFloorNudge } from '@/features/kitchen/liveChannel'
import type { TableOrder } from '../hooks/useTableOrders'

interface OrderStatusProps {
  order: Order
  items: (OrderItem & { itemName: string })[]
  tableLabel: string
  slug: string
  currency: string
  tableOrders: TableOrder[]
}

function EtaTimer({ estimatedReadyAt }: { estimatedReadyAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])

  if (!estimatedReadyAt) return null

  const secsLeft = Math.round((new Date(estimatedReadyAt).getTime() - now) / 1_000)
  const isLate = secsLeft <= 0

  const display = isLate
    ? 'Almost ready'
    : `${String(Math.floor(secsLeft / 60)).padStart(2, '0')}:${String(secsLeft % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center gap-1 my-1">
      <span className={`font-mono text-[42px] font-bold leading-none tabular-nums tracking-tight ${
        isLate ? 'text-herb-2' : 'text-saffron-3'
      }`}>
        {display}
      </span>
      <span className="text-[11px] font-medium text-ink-6 uppercase tracking-[0.08em]">
        {isLate ? 'finishing up' : 'estimated wait'}
      </span>
    </div>
  )
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

const STAGE_BADGE: Record<OrderStage, { label: string; color: string }> = {
  received:  { label: 'Received',  color: 'bg-paper-3 text-ink-5' },
  cooking:   { label: 'Cooking',   color: 'bg-saffron-wash text-saffron-3' },
  ready:     { label: 'Ready',     color: 'bg-herb-wash text-herb' },
  picked_up: { label: 'Picked up', color: 'bg-paper-3 text-ink-5' },
  cancelled: { label: 'Cancelled', color: 'bg-ember-wash text-ember' },
}

export function OrderStatus({ order, items, tableLabel, slug, currency, tableOrders }: OrderStatusProps) {
  const [helpSent, setHelpSent] = useState(false)
  const [helpLoading, setHelpLoading] = useState(false)

  /** Index of the active step, or `STAGE_STEPS.length` when every step is complete (e.g. picked up). */
  const activeStepIndex = (() => {
    if (order.stage === 'picked_up') return STAGE_STEPS.length
    const cur = STAGE_STEPS.findIndex(s => s.stage === order.stage)
    return cur >= 0 ? cur : 0
  })()

  async function callServer() {
    setHelpLoading(true)
    try {
      const { error } = await supabase
        .from('waiter_calls')
        .insert({ restaurant_id: order.restaurant_id, table_label: tableLabel })
      if (error) {
        console.error(error)
        return
      }
      notifyKitchenFloorNudge(order.restaurant_id)
      setHelpSent(true)
    } finally {
      setHelpLoading(false)
    }
  }

  const isCancelled = order.stage === 'cancelled'

  return (
    <div className="px-5 py-6 pb-10">
      {/* Stage header */}
      <div className="text-center mb-8">
        <p className="text-overline text-ink-6 uppercase tracking-[0.08em] mb-2">
          Order sent · {tableLabel}
        </p>
        <h1 className="font-display text-[32px] font-[500] tracking-[-0.02em] text-ink font-optical">
          {STAGE_HEADLINE[order.stage] ?? order.stage}
        </h1>
        {(order.stage === 'received' || order.stage === 'cooking') && (
          <div className="flex justify-center mt-3 mb-1">
            <EtaTimer estimatedReadyAt={order.estimated_ready_at} />
          </div>
        )}
        <p className="font-mono text-[12px] text-ink-6 mt-1 tabular-nums">
          #{order.id.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Kitchen timeline (horizontal) — only for non-cancelled */}
      {!isCancelled && (
        <div className="mb-8" aria-label="Order progress" role="list">
          <div className="flex w-full items-center px-0.5">
            {STAGE_STEPS.flatMap((step, i) => {
              const done = i < activeStepIndex
              const active = i === activeStepIndex && activeStepIndex < STAGE_STEPS.length
              const pending = !done && !active
              const joinComplete = i > 0 && activeStepIndex >= i

              const dot = (
                <div
                  key={step.stage}
                  role="listitem"
                  className={[
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-standard',
                    done && 'border-ink-3 bg-ink-3',
                    active && 'border-saffron bg-saffron shadow-[0_0_0_3px_var(--saffron-wash)]',
                    pending && 'border-paper-4 bg-paper',
                  ].filter(Boolean).join(' ')}
                  aria-current={active ? 'step' : undefined}
                >
                  {done && <Check className="h-2.5 w-2.5 text-paper" strokeWidth={3} aria-hidden />}
                </div>
              )

              if (i === 0) return [dot]
              return [
                <div
                  key={`join-${step.stage}`}
                  className={[
                    'mx-1 h-0.5 min-w-[12px] flex-1 rounded-pill transition-colors duration-standard',
                    joinComplete ? 'bg-ink-3' : 'bg-paper-3',
                  ].join(' ')}
                  aria-hidden
                />,
                dot,
              ]
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {STAGE_STEPS.map((step, i) => {
              const done = i < activeStepIndex
              const active = i === activeStepIndex && activeStepIndex < STAGE_STEPS.length
              const pending = !done && !active
              return (
                <p
                  key={step.stage}
                  className={[
                    'text-center text-[13px] leading-tight transition-colors duration-standard',
                    done && 'font-medium text-ink',
                    active && 'font-semibold text-saffron-3',
                    pending && 'font-medium text-ink-6',
                  ].filter(Boolean).join(' ')}
                >
                  {step.label}
                </p>
              )
            })}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 p-4 bg-ember-wash rounded-3 text-center">
          <p className="text-[14px] text-ember font-medium">
            This order was cancelled. Please speak to a server if you need help.
          </p>
        </div>
      )}

      {/* Order recap */}
      <div className="mb-5">
        <div className="flex flex-col">
          {items.map((item, i) => (
            <div key={i} className="flex gap-3 py-3 first:pt-0">
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
                {formatPriceExact(item.unit_price_cents * item.quantity, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Call server */}
      <div className="flex gap-2.5 items-center px-3.5 py-2.5 bg-paper-2 rounded-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-paper flex items-center justify-center text-ink shrink-0">
          {helpSent ? <CheckCircle2 size={18} className="text-herb" /> : <Bell size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-[15px] font-[500] leading-snug text-ink font-optical">
            {helpSent ? 'Help is on the way' : 'Need something from the floor?'}
          </h4>
          <p className="text-[12px] leading-snug text-ink-5 mt-0.5">
            {helpSent
              ? 'A server will be over shortly.'
              : 'Tap to ask a server to come to your table.'}
          </p>
        </div>
        {!helpSent && (
          <button
            onClick={callServer}
            disabled={helpLoading}
            className="shrink-0 h-9 px-3 rounded-[10px] border border-paper-4 bg-transparent text-ink text-[12px] font-semibold hover:bg-paper transition-colors duration-hover disabled:opacity-50 flex items-center gap-1.5"
          >
            {helpLoading && <Loader2 size={12} className="animate-spin" />}
            Call
          </button>
        )}
      </div>

      {/* Order more */}
      {slug && tableLabel && (
        <Link
          to={`/r/${slug}?table=${encodeURIComponent(tableLabel)}`}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-3 bg-ink text-paper text-[15px] font-semibold mb-7 hover:opacity-90 transition-opacity duration-hover"
        >
          <PlusCircle size={17} />
          Order more
        </Link>
      )}

      {/* All orders at this table */}
      {tableOrders.length > 0 && (
        <div>
          <h2 className="font-display text-[20px] font-[500] text-ink tracking-[-0.01em] font-optical mb-3">
            All orders at {tableLabel}
          </h2>
          <div className="space-y-3">
            {tableOrders.map(o => {
              const isCurrent = o.id === order.id
              const badge = STAGE_BADGE[o.stage]
              return (
                <div
                  key={o.id}
                  className={`rounded-3 overflow-hidden ${isCurrent ? 'bg-saffron-wash' : 'bg-paper-2'}`}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-mono text-[12px] text-ink-6 tabular-nums">
                      #{o.id.slice(0, 8).toUpperCase()}
                      {isCurrent && <span className="ml-2 text-saffron-3 font-sans font-medium">This order</span>}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {o.items.map((item, i) => (
                      <div key={i} className="flex gap-3 px-4 py-2.5 first:pt-0 last:pb-3">
                        <span className="font-mono text-[13px] font-semibold text-ink-6 w-6 tabular-nums shrink-0">
                          {item.quantity}×
                        </span>
                        <span className="flex-1 text-[13px] text-ink">{item.itemName}</span>
                        <span className="font-mono text-[13px] text-ink tabular-nums">
                          {formatPriceExact(item.unit_price_cents * item.quantity, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end px-4 pb-3 pt-1">
                    <span className="font-mono text-[14px] font-bold text-ink tabular-nums">
                      {formatPriceExact(o.subtotal_cents, currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
