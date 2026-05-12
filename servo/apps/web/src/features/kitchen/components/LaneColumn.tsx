import type { KitchenOrder } from '../hooks/useKitchenOrders'
import { OrderTicket } from './OrderTicket'

const LANE_LABEL: Record<string, string> = {
  received:  'Incoming',
  cooking:   'Cooking',
  ready:     'Ready',
  picked_up: 'Just done',
}

const COUNT_COLOR: Record<string, string> = {
  received:  'text-saffron',
  cooking:   'text-honey',
  ready:     'text-herb',
  picked_up: 'text-ink-6',
}

interface LaneColumnProps {
  stage: string
  orders: KitchenOrder[]
  pulsingId: string | null
  tick: number
  onSelect: (order: KitchenOrder) => void
}

export function LaneColumn({ stage, orders, pulsingId, tick, onSelect }: LaneColumnProps) {
  return (
    <div className="flex flex-col h-full min-w-0 bg-ink-2 border-r border-ink-3 last:border-r-0">
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-3 shrink-0">
        <span className="text-overline text-ink-7 uppercase tracking-widest">
          {LANE_LABEL[stage] ?? stage}
        </span>
        <span className={`font-mono text-mono font-semibold ${COUNT_COLOR[stage] ?? 'text-ink-6'}`}>
          {orders.length}
        </span>
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto space-y-px bg-ink-3">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-24 bg-ink-2">
            <span className="text-body-sm text-ink-5">—</span>
          </div>
        ) : (
          orders.map(order => (
            <OrderTicket
              key={order.id}
              order={order}
              pulsing={pulsingId === order.id}
              tick={tick}
              onClick={() => onSelect(order)}
            />
          ))
        )}
      </div>
    </div>
  )
}
