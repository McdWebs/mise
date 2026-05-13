import { useMemo } from 'react'
import { KpiTile } from '../components/KpiTile'
import { LiveOrdersStrip } from '../components/LiveOrdersStrip'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { useAdminTables } from '../hooks/useAdminTables'
import { Sk } from '../components/Skeleton'
import { formatPrice } from '@/features/guest/utils/formatPrice'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import type { AdminTable } from '../hooks/useAdminTables'
import type { AdminOrder } from '../hooks/useAdminOrders'

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

const ACTIVE_STAGES = ['received', 'cooking', 'ready']

interface OverviewPageProps {
  restaurant: AdminRestaurant
}

export function OverviewPage({ restaurant }: OverviewPageProps) {
  const since = useMemo(startOfToday, [])
  const { data: orders = [], isLoading } = useAdminOrders(restaurant.id, since)
  const { data: tables = [], isLoading: loadingTables } = useAdminTables(restaurant.id)
  const spark = useMemo(() => hourlyBuckets(orders), [orders])

  if (isLoading || loadingTables) return <OverviewSkeleton />

  const orderCount = orders.filter(o => o.stage !== 'cancelled').length
  const revenueCents = orders.reduce((sum, o) => sum + o.subtotal_cents, 0)
  const avgTicketCents = orderCount > 0 ? Math.round(revenueCents / orderCount) : 0

  // Tables occupancy
  const activeTableLabels = new Set(
    orders.filter(o => ACTIVE_STAGES.includes(o.stage)).map(o => o.table_label)
  )
  const occupiedCount = tables.filter(t => activeTableLabels.has(t.label)).length
  const pendingCallCount = tables.filter(t => t.has_pending_call).length

  // Per-table stats from today's orders (excluding cancelled)
  const tableStats: Record<string, { orderCount: number; revenueCents: number }> = {}
  for (const o of orders.filter(o => o.stage !== 'cancelled')) {
    if (!tableStats[o.table_label]) tableStats[o.table_label] = { orderCount: 0, revenueCents: 0 }
    tableStats[o.table_label].orderCount++
    tableStats[o.table_label].revenueCents += o.subtotal_cents
  }

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
          label="Tables"
          value={tables.length > 0 ? `${occupiedCount} occupied` : '—'}
          delta={
            tables.length === 0
              ? 'No tables set up'
              : pendingCallCount > 0
              ? `${pendingCallCount} need${pendingCallCount === 1 ? 's' : ''} a waiter`
              : `of ${tables.length} total`
          }
          deltaDown={pendingCallCount > 0}
          spark={Array(12).fill(0)}
        />
      </div>

      {/* Live orders */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-6">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
          Live orders
        </h2>
        <div className="text-body-sm text-ink-6 mb-3">
          {orders.filter(o => ACTIVE_STAGES.includes(o.stage)).length} active
        </div>
        <LiveOrdersStrip restaurantId={restaurant.id} />
      </div>

      {/* Tables */}
      {tables.length > 0 && (
        <TablesSection
          tables={tables}
          tableStats={tableStats}
          activeTableLabels={activeTableLabels}
          currency={restaurant.currency}
        />
      )}
    </>
  )
}

interface TablesSectionProps {
  tables: AdminTable[]
  tableStats: Record<string, { orderCount: number; revenueCents: number }>
  activeTableLabels: Set<string>
  currency: string
}

function TablesSection({ tables, tableStats, activeTableLabels, currency }: TablesSectionProps) {
  const occupiedCount = tables.filter(t => activeTableLabels.has(t.label)).length
  // Sort: waiter-needed first, then occupied, then free — within each group by sort_order
  const sorted = [...tables].sort((a, b) => {
    const rank = (t: AdminTable) =>
      t.has_pending_call ? 0 : activeTableLabels.has(t.label) ? 1 : 2
    return rank(a) - rank(b) || a.sort_order - b.sort_order
  })

  return (
    <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-paper-3">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical">
          Tables
        </h2>
        <span className="text-body-sm text-ink-6">
          {occupiedCount} of {tables.length} occupied
        </span>
      </div>

      {/* Column header */}
      <div
        className="grid gap-4 px-5 py-2.5 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest"
        style={{ gridTemplateColumns: '80px 1fr 140px 140px 60px 90px' }}
      >
        <span>Table</span>
        <span>Status</span>
        <span>Waiter</span>
        <span>Merged with</span>
        <span>Orders</span>
        <span className="text-right">Revenue</span>
      </div>

      {/* Rows */}
      {sorted.map(table => {
        const isOccupied = activeTableLabels.has(table.label)
        const needsWaiter = table.has_pending_call
        const isMergedSecondary = !!table.merged_into
        const stats = tableStats[table.label]

        const dotColor = needsWaiter
          ? 'bg-ember animate-pulse'
          : isOccupied
          ? 'bg-saffron'
          : 'bg-paper-4'

        const statusText = needsWaiter
          ? 'Waiter needed'
          : isOccupied
          ? 'Occupied'
          : isMergedSecondary
          ? 'Merged'
          : 'Free'

        const statusColor = needsWaiter
          ? 'text-ember'
          : isOccupied
          ? 'text-ink'
          : 'text-ink-5'

        // Find the primary table label for merged secondaries
        const mergedIntoLabel = isMergedSecondary
          ? (tables.find(t => t.id === table.merged_into)?.label ?? '—')
          : null

        // Other tables merged into this one
        const mergedSecondaryLabels = tables
          .filter(t => t.merged_into === table.id)
          .map(t => t.label)

        const mergedDisplay =
          mergedIntoLabel
            ? `→ ${mergedIntoLabel}`
            : mergedSecondaryLabels.length > 0
            ? `+${mergedSecondaryLabels.join(', ')}`
            : null

        return (
          <div
            key={table.id}
            className="grid gap-4 px-5 py-3 border-b border-paper-3 last:border-b-0 items-center text-body-sm"
            style={{ gridTemplateColumns: '80px 1fr 140px 140px 60px 90px' }}
          >
            <span className="font-mono font-bold text-ink">{table.label}</span>

            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
              <span className={statusColor}>{statusText}</span>
            </div>

            <span className="text-ink-5 truncate">{table.waiter_name ?? '—'}</span>

            <span className="text-ink-5 font-mono text-[12px]">{mergedDisplay ?? '—'}</span>

            <span className="font-mono tabular-nums text-ink">
              {stats?.orderCount ?? '—'}
            </span>

            <span className="font-mono tabular-nums text-ink text-right">
              {stats ? formatPrice(stats.revenueCents, currency) : '—'}
            </span>
          </div>
        )
      })}
    </div>
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

      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-6">
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

      <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
        <div className="px-5 py-4 border-b border-paper-3 flex justify-between">
          <Sk className="h-6 w-24" />
          <Sk className="h-4 w-32" />
        </div>
        <div className="px-5 py-2.5 border-b border-paper-3">
          <Sk className="h-3 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid gap-4 px-5 py-3 border-b border-paper-3 last:border-b-0 items-center" style={{ gridTemplateColumns: '80px 1fr 140px 140px 60px 90px' }}>
            <Sk className="h-4 w-12" />
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-20" />
            <Sk className="h-4 w-16" />
            <Sk className="h-4 w-8" />
            <Sk className="h-4 w-14 ml-auto" />
          </div>
        ))}
      </div>
    </>
  )
}
