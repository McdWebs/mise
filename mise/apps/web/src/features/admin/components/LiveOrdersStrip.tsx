import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useKitchenOrders } from '@/features/kitchen/hooks/useKitchenOrders'
import { elapsedSeconds, fmtTimer } from '@/features/kitchen/utils/timerUtils'
import { StagePill } from './StagePill'
import type { OrderStage } from '@mise/types'
import { orderLinesSummary } from '@/lib/orderLineLabel'
import { formatPriceExact } from '@/features/guest/utils/formatPrice'

const ACTIVE_STAGES: OrderStage[] = ['received', 'cooking', 'ready']

interface LiveOrdersStripProps {
  restaurantId: string
  currency: string
}

export function LiveOrdersStrip({ restaurantId, currency }: LiveOrdersStripProps) {
  const { orders, applyOrderUrgent } = useKitchenOrders(restaurantId)
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  async function toggleUrgent(orderId: string, current: boolean) {
    const next = !current
    applyOrderUrgent(orderId, next)
    const { error } = await supabase.from('orders').update({ urgent: next }).eq('id', orderId)
    if (error) applyOrderUrgent(orderId, current)
  }

  const live = orders.filter(o => ACTIVE_STAGES.includes(o.stage as OrderStage))

  if (live.length === 0) {
    return <p className="text-body-sm text-ink-6 py-2">No active orders right now.</p>
  }

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      {/* Header row */}
      <div
        className="grid gap-4 py-3 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest min-w-[560px]"
        style={{ gridTemplateColumns: '60px 1fr 110px 90px 80px 100px' }}
      >
        <span>Table</span>
        <span>Items</span>
        <span>Status</span>
        <span>Timer</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {live.map(order => (
        <div
          key={order.id}
          className={`grid gap-4 py-2.5 border-b border-paper-3 items-center text-body-sm last:border-b-0 min-w-[560px] ${order.urgent ? 'bg-ember-wash' : ''}`}
          style={{ gridTemplateColumns: '60px 1fr 110px 90px 80px 100px' }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono font-bold text-ink shrink-0">{order.table_label}</span>
            {order.urgent && (
              <span className="text-[9px] font-bold tracking-widest text-ember uppercase shrink-0">⚡</span>
            )}
          </div>
          <span className="text-ink-5 truncate">{orderLinesSummary(order.order_items)}</span>
          <StagePill stage={order.stage as OrderStage} />
          <span className="font-mono text-[13px] text-ink-5 tabular-nums">
            {fmtTimer(elapsedSeconds(order.created_at))}
          </span>
          <span className="font-mono font-semibold text-ink text-right tabular-nums">
            {formatPriceExact(order.subtotal_cents, currency)}
          </span>
          <button
            type="button"
            onClick={() => toggleUrgent(order.id, order.urgent)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill transition-colors duration-hover ${
              order.urgent
                ? 'bg-ember/10 text-ember hover:bg-ember/20'
                : 'bg-paper-3 text-ink-5 hover:bg-ember/10 hover:text-ember'
            }`}
          >
            {order.urgent ? 'Remove urgent' : 'Mark urgent'}
          </button>
        </div>
      ))}
    </div>
  )
}
