import { useMemo } from 'react'
import { KpiTile } from '../components/KpiTile'
import { LiveOrdersStrip } from '../components/LiveOrdersStrip'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { Sk } from '../components/Skeleton'
import { formatPrice } from '@/features/guest/utils/formatPrice'
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
  const { data: orders = [], isLoading } = useAdminOrders(restaurant.id, since)
  const spark = useMemo(() => hourlyBuckets(orders), [orders])

  if (isLoading) return <OverviewSkeleton />

  const orderCount = orders.filter(o => o.stage !== 'cancelled').length
  const revenueCents = orders.reduce((sum, o) => sum + o.subtotal_cents, 0)
  const avgTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0

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
          value={revenueCents > 0 ? formatPrice(revenueCents, restaurant.currency) : '—'}
          delta={revenueCents > 0 ? formatPrice(revenueCents, restaurant.currency) : 'None yet'}
          spark={spark.map(v => v * 30)}
        />
        <KpiTile
          label="Avg. ticket"
          value={avgTicketCents > 0 ? formatPrice(avgTicketCents, restaurant.currency) : '—'}
          delta={avgTicketCents > 0 ? 'per order' : 'No orders'}
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

function OverviewSkeleton() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div className="space-y-2">
          <Sk className="h-8 w-56" />
          <Sk className="h-4 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <Sk className="h-3 w-24" />
            <Sk className="h-9 w-16" />
            <Sk className="h-3 w-20" />
            <div className="flex items-end gap-0.5 h-6 mt-1">
              {Array.from({ length: 12 }).map((_, j) => (
                <Sk key={j} className="flex-1 rounded-[2px]" style={{ height: `${20 + Math.random() * 80}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <Sk className="h-6 w-32 mb-2" />
        <Sk className="h-3 w-20 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid gap-4 items-center" style={{ gridTemplateColumns: '60px 1fr 110px 90px 80px' }}>
              <Sk className="h-4 w-full" />
              <Sk className="h-4 w-3/4" />
              <Sk className="h-5 w-20 rounded-pill" />
              <Sk className="h-4 w-16" />
              <Sk className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
