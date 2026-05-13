import { useEffect, useState } from 'react'
import type { KitchenOrder } from '../hooks/useKitchenOrders'
import { OrderTicket } from './OrderTicket'

/** MIME type for kitchen lane drag-and-drop (order id payload). */
export const KITCHEN_ORDER_DRAG_TYPE = 'application/x-servo-order-id'

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
  onDropOrder: (orderId: string, targetStage: string) => void
}

export function LaneColumn({ stage, orders, pulsingId, tick, onSelect, onDropOrder }: LaneColumnProps) {
  const [dropActive, setDropActive] = useState(false)

  useEffect(() => {
    function endDrag() {
      setDropActive(false)
    }
    window.addEventListener('dragend', endDrag)
    return () => window.removeEventListener('dragend', endDrag)
  }, [])

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    setDropActive(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setDropActive(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDropActive(false)
    const orderId =
      e.dataTransfer.getData(KITCHEN_ORDER_DRAG_TYPE) || e.dataTransfer.getData('text/plain')
    if (orderId) onDropOrder(orderId, stage)
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 bg-ink-2 border-r border-ink-3 last:border-r-0">
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-3 shrink-0">
        <span className="text-overline text-ink-7 uppercase tracking-widest">
          {LANE_LABEL[stage] ?? stage}
        </span>
        <span className={`font-mono text-mono font-semibold ${COUNT_COLOR[stage] ?? 'text-ink-6'}`}>
          {orders.length}
        </span>
      </div>

      {/* Ticket list — flex column + min-h-0 so empty state fills lane height */}
      <div
        className={`flex flex-1 flex-col min-h-0 overflow-y-auto space-y-px bg-ink-3 transition-colors duration-hover ${dropActive ? 'bg-saffron/15 ring-1 ring-inset ring-saffron/40' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {orders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-ink-2 min-h-0">
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
              onDragStart={e => {
                e.dataTransfer.setData(KITCHEN_ORDER_DRAG_TYPE, order.id)
                e.dataTransfer.setData('text/plain', order.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
