import { useMemo, useState } from 'react'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { StagePill } from '../components/StagePill'
import { Sk } from '../components/Skeleton'
import { formatPriceExact } from '@/features/guest/utils/formatPrice'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import type { OrderStage } from '@servo/types'
import { orderLinesSummary } from '@/lib/orderLineLabel'

type Range = 'today' | 'week'

function startOf(range: Range): string {
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

function exportCSV(orders: ReturnType<typeof useAdminOrders>['data'], currency: string) {
  if (!orders) return
  const rows = [
    ['Time', 'Table', 'Items', 'Status', 'Order', 'Total'],
    ...orders.map(o => [
      new Date(o.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }),
      o.table_label,
      `"${orderLinesSummary(o.order_items)}"`,
      o.stage,
      `#${o.id.slice(-4).toUpperCase()}`,
      formatPriceExact(o.subtotal_cents, currency),
    ]),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface OrdersPageProps {
  restaurant: AdminRestaurant
}

export function OrdersPage({ restaurant }: OrdersPageProps) {
  const [range, setRange] = useState<Range>('today')
  const since = useMemo(() => startOf(range), [range])
  const { data: orders = [], isLoading } = useAdminOrders(restaurant.id, since)

  const rangeLabel = range === 'today'
    ? new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Last 7 days'

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">Orders</h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            {rangeLabel} · {orders.length} order{orders.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['today', 'week'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-pill border-[1.5px] text-body-sm font-medium transition-colors duration-hover ${range === r ? 'bg-ink border-ink text-paper' : 'bg-paper border-paper-4 text-ink hover:border-ink-5'}`}
            >
              {r === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
          <button
            onClick={() => exportCSV(orders, restaurant.currency)}
            className="px-3 py-1.5 rounded-pill border-[1.5px] border-paper-4 text-body-sm font-medium text-ink hover:border-ink-5 transition-colors duration-hover"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
        {/* Table header */}
        <div
          className="grid gap-4 px-5 py-3 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest"
          style={{ gridTemplateColumns: '80px 60px 1fr 120px 100px 80px' }}
        >
          <span>Time</span>
          <span>Table</span>
          <span>Items</span>
          <span>Status</span>
          <span>Order</span>
          <span className="text-right">Total</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-paper-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-4 px-5 py-3.5 items-center" style={{ gridTemplateColumns: '80px 60px 1fr 120px 100px 80px' }}>
                <Sk className="h-4 w-12" />
                <Sk className="h-4 w-8" />
                <Sk className="h-4 w-4/5" />
                <Sk className="h-5 w-20 rounded-pill" />
                <Sk className="h-4 w-14" />
                <Sk className="h-4 w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-5 py-8 text-center text-body-sm text-ink-6">
            No orders for this period.
          </div>
        ) : (
          orders.map(order => (
            <div
              key={order.id}
              className="grid gap-4 px-5 py-3 border-b border-paper-3 items-center text-body-sm last:border-b-0"
              style={{ gridTemplateColumns: '80px 60px 1fr 120px 100px 80px' }}
            >
              <span className="font-mono text-[12px] text-ink-6">
                {new Date(order.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="font-mono font-bold text-ink">{order.table_label}</span>
              <span className="text-ink-5 truncate">{orderLinesSummary(order.order_items)}</span>
              <StagePill stage={order.stage as OrderStage} />
              <span className="font-mono text-[12px] text-ink-6">
                #{order.id.slice(-4).toUpperCase()}
              </span>
              <span className="font-mono font-semibold text-ink text-right tabular-nums">
                {formatPriceExact(order.subtotal_cents, restaurant.currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
