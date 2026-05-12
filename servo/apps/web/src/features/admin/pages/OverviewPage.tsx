import { useMemo } from 'react'
import { KpiTile } from '../components/KpiTile'
import { LiveOrdersStrip } from '../components/LiveOrdersStrip'
import { useAdminOrders } from '../hooks/useAdminOrders'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function hourlyBuckets(orders: { created_at: string }[], n = 12): number[] {
  const now = Date.now()
  const buckets = Array<number>(n).fill(0)
  orders.forEach(o => {
    const diffHours = Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60))
    if (diffHours < n) buckets[n - 1 - diffHours]++
  })
  return buckets
}

interface OverviewPageProps {
  restaurant: AdminRestaurant
}

export function OverviewPage({ restaurant }: OverviewPageProps) {
  const since = useMemo(startOfToday, [])
  const { data: orders = [] } = useAdminOrders(restaurant.id, since)

  const orderCount = orders.filter(o => o.stage !== 'cancelled').length
  const revenue = orders.reduce((sum, o) => sum + o.subtotal_cents, 0) / 100
  const avgTicket = orderCount > 0 ? revenue / orderCount : 0
  const spark = useMemo(() => hourlyBuckets(orders), [orders])

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Service overview
          </h1>
          <div className="text-body-sm text-ink-6 mt-0.5">Today · {today}</div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        <KpiTile
          label="Orders today"
          value={String(orderCount)}
          delta={orderCount > 0 ? `${orderCount} placed` : 'None yet'}
          spark={spark}
        />
        <KpiTile
          label="Revenue"
          value={`$${revenue.toFixed(2)}`}
          delta={revenue > 0 ? `+$${revenue.toFixed(0)}` : 'None yet'}
          spark={spark.map(v => v * 30)}
        />
        <KpiTile
          label="Avg. ticket"
          value={avgTicket > 0 ? `$${avgTicket.toFixed(2)}` : '—'}
          delta={avgTicket > 0 ? `per order` : 'No orders'}
          deltaDown={false}
          spark={spark}
        />
        <KpiTile
          label="Assistant uses"
          value="—"
          delta="Live in phase 6"
          spark={Array(12).fill(0)}
        />
      </div>

      {/* Live orders */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
          Live orders
        </h2>
        <div className="text-body-sm text-ink-6 mb-3">
          {orders.filter(o => ['received','cooking','ready'].includes(o.stage)).length} active
        </div>
        <LiveOrdersStrip restaurantId={restaurant.id} />
      </div>
    </>
  )
}
