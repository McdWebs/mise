import { useMemo } from 'react'
import { useAdminTables } from '../hooks/useAdminTables'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { Sk } from '../components/Skeleton'
import { formatPrice } from '@/features/guest/utils/formatPrice'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import type { AdminTable } from '../hooks/useAdminTables'

const ACTIVE_STAGES = ['received', 'cooking', 'ready']

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

interface TablesPageProps {
  restaurant: AdminRestaurant
}

export function TablesPage({ restaurant }: TablesPageProps) {
  const since = useMemo(startOfToday, [])
  const { data: tables = [], isLoading: loadingTables } = useAdminTables(restaurant.id)
  const { data: orders = [], isLoading: loadingOrders } = useAdminOrders(restaurant.id, since)

  if (loadingTables || loadingOrders) return <TablesSkeleton />

  const activeTableLabels = new Set(
    orders.filter(o => ACTIVE_STAGES.includes(o.stage)).map(o => o.table_label)
  )

  // Per-table stats from today's non-cancelled orders
  const tableStats: Record<string, { orderCount: number; revenueCents: number }> = {}
  for (const o of orders.filter(o => o.stage !== 'cancelled')) {
    if (!tableStats[o.table_label]) tableStats[o.table_label] = { orderCount: 0, revenueCents: 0 }
    tableStats[o.table_label].orderCount++
    tableStats[o.table_label].revenueCents += o.subtotal_cents
  }

  const occupiedCount = tables.filter(t => activeTableLabels.has(t.label)).length
  const freeCount = tables.filter(t => !activeTableLabels.has(t.label) && !t.merged_into).length
  const pendingCallCount = tables.filter(t => t.has_pending_call).length
  const totalRevenueCents = Object.values(tableStats).reduce((s, t) => s + t.revenueCents, 0)

  // Sort: waiter-needed → occupied → free
  const sorted = [...tables].sort((a, b) => {
    const rank = (t: AdminTable) =>
      t.has_pending_call ? 0 : activeTableLabels.has(t.label) ? 1 : 2
    return rank(a) - rank(b) || a.sort_order - b.sort_order
  })

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Tables
          </h1>
          <div className="text-body-sm text-ink-6 mt-0.5">Today · {today}</div>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="bg-paper border border-paper-3 rounded-3 px-6 py-12 text-center">
          <p className="font-display text-[20px] font-[500] text-ink mb-1 font-optical">No tables yet</p>
          <p className="text-body-sm text-ink-5">
            Add tables from the kitchen display to start tracking occupancy and revenue.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3 mb-7">
            <KpiCard label="Total tables" value={String(tables.length)} />
            <KpiCard
              label="Occupied"
              value={String(occupiedCount)}
              accent={occupiedCount > 0 ? 'saffron' : undefined}
            />
            <KpiCard
              label="Waiter calls"
              value={String(pendingCallCount)}
              accent={pendingCallCount > 0 ? 'ember' : undefined}
            />
            <KpiCard
              label="Revenue today"
              value={totalRevenueCents > 0 ? formatPrice(totalRevenueCents, restaurant.currency) : '—'}
            />
          </div>

          {/* Tables grid */}
          <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-paper-3">
              <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical">
                Floor
              </h2>
              <span className="text-body-sm text-ink-6">
                {occupiedCount} occupied · {freeCount} free
              </span>
            </div>

            {/* Column headers */}
            <div
              className="grid gap-4 px-5 py-2.5 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest"
              style={{ gridTemplateColumns: '80px 60px 1fr 140px 140px 60px 90px' }}
            >
              <span>Table</span>
              <span>Seats</span>
              <span>Status</span>
              <span>Waiter</span>
              <span>Merged with</span>
              <span>Orders</span>
              <span className="text-right">Revenue</span>
            </div>

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
                ? 'text-ember font-medium'
                : isOccupied
                ? 'text-ink'
                : 'text-ink-5'

              const mergedIntoLabel = isMergedSecondary
                ? (tables.find(t => t.id === table.merged_into)?.label ?? '—')
                : null

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
                  className={`grid gap-4 px-5 py-3.5 border-b border-paper-3 last:border-b-0 items-center text-body-sm ${needsWaiter ? 'bg-ember-wash' : ''}`}
                  style={{ gridTemplateColumns: '80px 60px 1fr 140px 140px 60px 90px' }}
                >
                  <span className="font-mono font-bold text-ink">{table.label}</span>

                  <span className="text-ink-5">{table.seats}</span>

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
                    {stats ? formatPrice(stats.revenueCents, restaurant.currency) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'saffron' | 'ember'
}) {
  const valueColor =
    accent === 'ember'
      ? 'text-ember'
      : accent === 'saffron'
      ? 'text-saffron'
      : 'text-ink'

  return (
    <div className="bg-paper border border-paper-3 rounded-3 p-4">
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-[32px] font-[500] tracking-[-0.02em] font-optical leading-none ${valueColor}`}>
        {value}
      </p>
    </div>
  )
}

function TablesSkeleton() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div className="space-y-2">
          <Sk className="h-8 w-32" />
          <Sk className="h-4 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <Sk className="h-3 w-24" />
            <Sk className="h-9 w-16" />
          </div>
        ))}
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
        <div className="px-5 py-4 border-b border-paper-3 flex justify-between">
          <Sk className="h-6 w-16" />
          <Sk className="h-4 w-32" />
        </div>
        <div className="px-5 py-2.5 border-b border-paper-3">
          <Sk className="h-3 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-4 px-5 py-3.5 border-b border-paper-3 last:border-b-0 items-center"
            style={{ gridTemplateColumns: '80px 60px 1fr 140px 140px 60px 90px' }}
          >
            <Sk className="h-4 w-10" />
            <Sk className="h-4 w-6" />
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-20" />
            <Sk className="h-4 w-10" />
            <Sk className="h-4 w-6" />
            <Sk className="h-4 w-14 ml-auto" />
          </div>
        ))}
      </div>
    </>
  )
}
