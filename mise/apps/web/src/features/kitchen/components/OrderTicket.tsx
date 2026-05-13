import type { KitchenOrder } from '../hooks/useKitchenOrders'
import { elapsedSeconds, fmtTimer, timerClass } from '../utils/timerUtils'
import type { OrderStage } from '@mise/types'

const RAIL_COLOR: Record<string, string> = {
  received:  '#D97706',
  cooking:   '#C28A00',
  ready:     '#3F7A3A',
  picked_up: '#6A5E51',
}

const TIMER_CLASS: Record<string, string> = {
  '':      'text-ink-6',
  warn:    'text-honey-2',
  urgent:  'text-ember',
}

interface OrderTicketProps {
  order: KitchenOrder
  pulsing: boolean
  tick: number
  onClick: () => void
  onDragStart?: (e: React.DragEvent) => void
}

export function OrderTicket({ order, pulsing, tick: _tick, onClick, onDragStart }: OrderTicketProps) {
  const stage = order.stage as OrderStage
  const elapsed = elapsedSeconds(order.updated_at)
  const tc = timerClass(stage, elapsed)
  const dragging = Boolean(onDragStart)

  return (
    <button
      type="button"
      draggable={dragging}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`relative w-full text-left bg-paper overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron ${dragging ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{ borderLeft: `3px solid ${RAIL_COLOR[stage] ?? '#6A5E51'}` }}
    >
      {/* New-order pulse overlay */}
      {pulsing && (
        <span className="absolute inset-0 pointer-events-none animate-order-pulse rounded-none" />
      )}

      <div className="px-3 pt-3 pb-2.5 space-y-2">
        {/* Header row: table label + timer */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-mono text-ink font-semibold tracking-tight uppercase">
            {order.table_label ?? '—'}
          </span>
          {stage !== 'picked_up' && stage !== 'cancelled' && (
            <span className={`font-mono text-mono tabular-nums ${TIMER_CLASS[tc]}`}>
              {fmtTimer(elapsed)}
            </span>
          )}
        </div>

        {/* Item lines */}
        <ul className="space-y-0.5">
          {order.order_items.map(item => {
            const plan = Boolean(item.restaurant_plan_id)
            const title = item.restaurant_plans?.title ?? item.menu_items?.name ?? '—'
            const detailLines =
              plan && item.restaurant_plans?.includes?.length
                ? item.restaurant_plans.includes
                : item.modifiers ?? []
            return (
              <li key={item.id}>
                <span className="font-mono text-[11px] text-ink-6 mr-1.5">
                  {item.quantity}×
                </span>
                <span className="text-body-sm text-ink">
                  {title}
                  {plan && (
                    <span className="ml-1.5 text-[9px] font-mono font-bold text-saffron uppercase tracking-wider">
                      plan
                    </span>
                  )}
                </span>
                {detailLines.length > 0 && (
                  <div className="mt-0.5 pl-5 space-y-0.5">
                    {detailLines.map((mod, i) => (
                      <p key={i} className="text-[11px] text-ember leading-tight">
                        {mod}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Footer: order ID */}
      <div className="px-3 pb-2 flex items-center justify-end">
        <span className="font-mono text-[10px] text-ink-5 tracking-widest">
          #{order.id.slice(-4).toUpperCase()}
        </span>
      </div>
    </button>
  )
}
