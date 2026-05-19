import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Mascot } from '@mise/ui'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { KpiTile } from '../components/KpiTile'
import { LiveOrdersStrip } from '../components/LiveOrdersStrip'
import { StagePill } from '../components/StagePill'
import { DatePicker } from '../components/DatePicker'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { useAdminTables } from '../hooks/useAdminTables'
import { Sk } from '../components/Skeleton'
import { formatPrice, formatPriceExact } from '@/features/guest/utils/formatPrice'
import { orderLinesSummary } from '@/lib/orderLineLabel'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import type { AdminTable } from '../hooks/useAdminTables'
import type { OrderStage } from '@mise/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | '30d' | 'custom'

const RANGE_LABELS: Record<Range, string> = {
  today:  'Today',
  '7d':   '7 days',
  '30d':  '30 days',
  custom: 'Custom',
}

const ACTIVE_STAGES = ['received', 'cooking', 'ready']

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function presetSince(range: Exclude<Range, 'custom' | 'today'>): string {
  const d = new Date()
  if (range === '7d') {
    d.setDate(d.getDate() - 6)
  } else {
    d.setDate(d.getDate() - 29)
  }
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dailyBuckets(orders: { created_at: string; subtotal_cents: number }[], n: number) {
  const now = new Date()
  const count = Array<number>(n).fill(0)
  const revenue = Array<number>(n).fill(0)
  orders.forEach(o => {
    const dayAgo = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (dayAgo < n) { count[n - 1 - dayAgo]++; revenue[n - 1 - dayAgo] += o.subtotal_cents }
  })
  return { count, revenue }
}

function hourlyBuckets(orders: { created_at: string; subtotal_cents: number }[], n = 12) {
  const now = Date.now()
  const count = Array<number>(n).fill(0)
  const revenue = Array<number>(n).fill(0)
  orders.forEach(o => {
    const diffH = Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60))
    if (diffH < n) { count[n - 1 - diffH]++; revenue[n - 1 - diffH] += o.subtotal_cents }
  })
  return { count, revenue }
}

function dayLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return n <= 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : String(d.getDate())
  })
}

function formatOrderTime(iso: string, showDate: boolean): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
  if (!showDate) return time
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + time
}

function exportCSV(
  orders: { id: string; created_at: string; table_label: string; stage: string; subtotal_cents: number; order_items: { quantity: number; menu_items: { name: string } | null; restaurant_plans: { title: string } | null }[] }[],
  currency: string,
) {
  const nonCancelled = orders.filter(o => o.stage !== 'cancelled')
  const grandTotalCents = nonCancelled.reduce((s, o) => s + o.subtotal_cents, 0)

  const rows = [
    ['Date', 'Time', 'Table', 'Items', 'Status', 'Order', 'Total'],
    ...orders.map(o => {
      const d = new Date(o.created_at)
      return [
        d.toLocaleDateString('en-CA'),
        d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }),
        o.table_label,
        `"${orderLinesSummary(o.order_items)}"`,
        o.stage,
        `#${o.id.slice(-4).toUpperCase()}`,
        formatPriceExact(o.subtotal_cents, currency),
      ]
    }),
    [],
    ['', '', '', '', '', `${nonCancelled.length} order${nonCancelled.length !== 1 ? 's' : ''}`, formatPriceExact(grandTotalCents, currency)],
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

// ── Activity chart ─────────────────────────────────────────────────────────────

function ActivityChart({ buckets, labels, n }: { buckets: number[]; labels: string[]; n: number }) {
  const max = Math.max(...buckets, 1)
  const showEvery = n <= 7 ? 1 : 5
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <div className="min-w-[240px]">
        <div className="flex items-end gap-0.5 h-16">
          {buckets.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div
                className={`rounded-[2px] w-full transition-all ${i === buckets.length - 1 ? 'bg-saffron' : 'bg-paper-3'}`}
                style={{ height: `${Math.max(2, Math.round((v / max) * 60))}px` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-0.5 mt-1">
          {labels.map((label, i) => (
            <div key={i} className="flex-1 text-center">
              {(i % showEvery === 0 || i === labels.length - 1) && (
                <span className={`text-[10px] tabular-nums ${i === labels.length - 1 ? 'text-saffron font-semibold' : 'text-ink-6'}`}>
                  {label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── KpiCard (tables section) ───────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: 'saffron' | 'ember' }) {
  const valueColor = accent === 'ember' ? 'text-ember' : accent === 'saffron' ? 'text-saffron' : 'text-ink'
  return (
    <div className="min-w-0 bg-paper border border-paper-3 rounded-3 p-4">
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-[32px] font-[500] tracking-[-0.02em] font-optical leading-tight break-words ${valueColor}`}>
        {value}
      </p>
    </div>
  )
}

// ── Tables section ─────────────────────────────────────────────────────────────

interface TablesSectionProps {
  tables: AdminTable[]
  tableStats: Record<string, { orderCount: number; revenueCents: number }>
  activeTableLabels: Set<string>
  currency: string
}

function TablesSection({ tables, tableStats, activeTableLabels, currency }: TablesSectionProps) {
  const occupiedCount = tables.filter(t => activeTableLabels.has(t.label)).length
  const freeCount = tables.filter(t => !activeTableLabels.has(t.label) && !t.merged_into).length
  const pendingCallCount = tables.filter(t => t.has_pending_call).length
  const totalRevenueCents = Object.values(tableStats).reduce((s, t) => s + t.revenueCents, 0)

  const sorted = [...tables].sort((a, b) => {
    const rank = (t: AdminTable) => t.has_pending_call ? 0 : activeTableLabels.has(t.label) ? 1 : 2
    return rank(a) - rank(b) || a.sort_order - b.sort_order
  })

  return (
    <>
      {/* Tables KPI cards */}
      <div className="grid min-w-0 grid-cols-2 gap-3 mb-7 lg:grid-cols-4">
        <KpiCard label="Total tables" value={String(tables.length)} />
        <KpiCard label="Occupied" value={String(occupiedCount)} accent={occupiedCount > 0 ? 'saffron' : undefined} />
        <KpiCard label="Waiter calls" value={String(pendingCallCount)} accent={pendingCallCount > 0 ? 'ember' : undefined} />
        <KpiCard
          label="Revenue today"
          value={totalRevenueCents > 0 ? formatPrice(totalRevenueCents, currency) : '—'}
        />
      </div>

      {/* Floor grid */}
      <div className="min-w-0 bg-paper border border-paper-3 rounded-3 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-4 border-b border-paper-3">
          <h2 className="min-w-0 truncate font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical">
            Floor
          </h2>
          <span className="shrink-0 text-body-sm text-ink-6">
            {occupiedCount} occupied · {freeCount} free
          </span>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <div
            className="grid gap-4 px-5 py-2.5 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest min-w-[640px]"
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

            const dotColor = needsWaiter ? 'bg-ember animate-pulse' : isOccupied ? 'bg-saffron' : 'bg-paper-4'
            const statusText = needsWaiter ? 'Waiter needed' : isOccupied ? 'Occupied' : isMergedSecondary ? 'Merged' : 'Free'
            const statusColor = needsWaiter ? 'text-ember font-medium' : isOccupied ? 'text-ink' : 'text-ink-5'

            const mergedIntoLabel = isMergedSecondary ? (tables.find(t => t.id === table.merged_into)?.label ?? '—') : null
            const mergedSecondaryLabels = tables.filter(t => t.merged_into === table.id).map(t => t.label)
            const mergedDisplay = mergedIntoLabel
              ? `→ ${mergedIntoLabel}`
              : mergedSecondaryLabels.length > 0
              ? `+${mergedSecondaryLabels.join(', ')}`
              : null

            return (
              <div
                key={table.id}
                className={`grid gap-4 px-5 py-3.5 border-b border-paper-3 last:border-b-0 items-center text-body-sm min-w-[640px] ${needsWaiter ? 'bg-ember-wash' : ''}`}
                style={{ gridTemplateColumns: '80px 60px 1fr 140px 140px 60px 90px' }}
              >
                <span className="font-mono font-bold text-ink">{table.label}</span>
                <span className="text-ink-5">{table.seats}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <span className={statusColor}>{statusText}</span>
                </div>
                <span className="text-ink-5 truncate">{table.waiter_name ?? '—'}</span>
                <span className="min-w-0 truncate font-mono text-[12px] text-ink-5">{mergedDisplay ?? '—'}</span>
                <span className="font-mono tabular-nums text-ink">{stats?.orderCount ?? '—'}</span>
                <span className="font-mono tabular-nums text-ink text-right">{stats ? formatPrice(stats.revenueCents, currency) : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface OverviewPageProps {
  restaurant: AdminRestaurant
}

export function OverviewPage({ restaurant }: OverviewPageProps) {
  const qc = useQueryClient()
  const [range, setRange] = useState<Range>('today')
  const [customFrom, setCustomFrom] = useState(() => todayISO())
  const [customTo, setCustomTo]     = useState(() => todayISO())
  const [appliedFrom, setAppliedFrom] = useState(customFrom)
  const [appliedTo, setAppliedTo]     = useState(customTo)

  // Shared "start of today" ref so today-range and table section share a cache key
  const todaySince = useMemo(startOfToday, [])

  const since = useMemo(() => {
    if (range === 'today')  return todaySince
    if (range === 'custom') return `${appliedFrom}T00:00:00.000Z`
    return presetSince(range as Exclude<Range, 'custom' | 'today'>)
  }, [range, appliedFrom, todaySince])

  const until = useMemo(() => {
    if (range === 'custom') return `${appliedTo}T23:59:59.999Z`
    return undefined
  }, [range, appliedTo])

  const { data: orders = [], isLoading } = useAdminOrders(restaurant.id, since, until)
  const { data: tables = [], isLoading: loadingTables } = useAdminTables(restaurant.id)

  // Today's orders for tables section (always today, regardless of range)
  const { data: todayOrders = [] } = useAdminOrders(restaurant.id, todaySince)

  // ── Orders derived data ──
  const nonCancelledOrders = useMemo(() => orders.filter(o => o.stage !== 'cancelled'), [orders])
  const cancelledOrders    = useMemo(() => orders.filter(o => o.stage === 'cancelled'),  [orders])
  const totalRevenueCents  = useMemo(() => nonCancelledOrders.reduce((s, o) => s + o.subtotal_cents, 0), [nonCancelledOrders])
  const avgTicketCents     = nonCancelledOrders.length > 0 ? Math.round(totalRevenueCents / nonCancelledOrders.length) : 0
  const cancelRate         = orders.length > 0 ? Math.round((cancelledOrders.length / orders.length) * 100) : 0

  const bucketCount = range === 'today' ? 12 : range === '7d' ? 7 : 30

  const { count: countBuckets, revenue: revBuckets } = useMemo(() => {
    if (range === 'today') return hourlyBuckets(nonCancelledOrders)
    if (range === 'custom') {
      const from = new Date(appliedFrom).getTime()
      const to   = new Date(appliedTo).getTime()
      const n    = Math.min(Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1), 90)
      const count   = Array<number>(n).fill(0)
      const revenue = Array<number>(n).fill(0)
      nonCancelledOrders.forEach(o => {
        const dayIdx = Math.floor((new Date(o.created_at).getTime() - from) / (1000 * 60 * 60 * 24))
        if (dayIdx >= 0 && dayIdx < n) { count[dayIdx]++; revenue[dayIdx] += o.subtotal_cents }
      })
      return { count, revenue }
    }
    return dailyBuckets(nonCancelledOrders, bucketCount)
  }, [nonCancelledOrders, range, bucketCount, appliedFrom, appliedTo])

  const chartLabels = useMemo(() => {
    if (range === 'today') return Array.from({ length: 12 }, (_, i) => {
      const h = new Date()
      h.setHours(h.getHours() - (11 - i), 0, 0, 0)
      return i % 3 === 0 ? `${h.getHours()}:00` : ''
    })
    if (range === 'custom') {
      const from = new Date(appliedFrom)
      return countBuckets.map((_, i) => {
        const d = new Date(from); d.setDate(d.getDate() + i)
        return countBuckets.length <= 14
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : String(d.getDate())
      })
    }
    return dayLabels(bucketCount)
  }, [range, bucketCount, appliedFrom, countBuckets])

  const periodLabel = useMemo(() => {
    if (range === 'today')  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (range === '7d')     return 'Last 7 days'
    if (range === '30d')    return 'Last 30 days'
    if (appliedFrom === appliedTo) return new Date(appliedFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${new Date(appliedFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(appliedTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [range, appliedFrom, appliedTo])

  // ── Tables derived data (always today) ──
  const activeTableLabels = useMemo(
    () => new Set(todayOrders.filter(o => ACTIVE_STAGES.includes(o.stage)).map(o => o.table_label)),
    [todayOrders]
  )

  const tableStats = useMemo(() => {
    const stats: Record<string, { orderCount: number; revenueCents: number }> = {}
    for (const o of todayOrders.filter(o => o.stage !== 'cancelled')) {
      if (!stats[o.table_label]) stats[o.table_label] = { orderCount: 0, revenueCents: 0 }
      stats[o.table_label].orderCount++
      stats[o.table_label].revenueCents += o.subtotal_cents
    }
    return stats
  }, [todayOrders])

  const showDate  = range !== 'today'
  const showChart = range !== 'today' && countBuckets.length > 1

  async function toggleUrgent(orderId: string, current: boolean) {
    const next = !current
    await supabase.from('orders').update({ urgent: next }).eq('id', orderId)
    await qc.invalidateQueries({ queryKey: ['admin-orders'] })
  }

  if (isLoading || loadingTables) return <OverviewSkeleton />

  return (
    <>
      {/* Header */}
      <div className="mb-6 min-w-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] sm:text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
              Overview
            </h1>
            <div className="text-body-sm text-ink-6 mt-0.5 break-words">
              {periodLabel} · {nonCancelledOrders.length} order{nonCancelledOrders.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1 overflow-x-auto rounded-2 bg-paper-2 p-1 sm:flex-nowrap">
              {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors duration-hover ${
                    range === r ? 'bg-paper text-ink shadow-1' : 'text-ink-5 hover:text-ink'
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportCSV(orders, restaurant.currency)}
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-2 border-[1.5px] border-paper-4 bg-paper px-3 py-1.5 text-body-sm font-semibold text-ink transition-[border-color,background-color,color] duration-hover hover:border-paper-4 hover:bg-paper-2 focus-visible:outline-none focus-visible:border-saffron"
            >
              <Download size={14} strokeWidth={2.25} className="shrink-0 text-ink-5 transition-colors duration-hover group-hover:text-ink" aria-hidden />
              Export CSV
            </button>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <DatePicker value={customFrom} max={customTo} onChange={v => setCustomFrom(v)} placeholder="From" />
            <span className="text-body-sm text-ink-6 hidden sm:inline">to</span>
            <DatePicker value={customTo} min={customFrom} max={todayISO()} onChange={v => setCustomTo(v)} placeholder="To" />
            <button
              type="button"
              onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-2 bg-saffron text-paper text-body-sm font-semibold hover:bg-saffron-2 transition-colors duration-hover"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Orders KPI row */}
      <div className="grid min-w-0 grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        <KpiTile
          label="Orders"
          value={String(nonCancelledOrders.length)}
          delta={nonCancelledOrders.length > 0 ? periodLabel : 'None yet'}
          spark={countBuckets}
        />
        <KpiTile
          label="Revenue"
          value={totalRevenueCents > 0 ? formatPrice(totalRevenueCents, restaurant.currency) : '—'}
          delta={totalRevenueCents > 0 ? 'total' : 'No orders'}
          spark={revBuckets}
        />
        <KpiTile
          label="Avg ticket"
          value={avgTicketCents > 0 ? formatPrice(avgTicketCents, restaurant.currency) : '—'}
          delta={avgTicketCents > 0 ? 'per order' : 'No orders'}
          spark={countBuckets}
        />
        <KpiTile
          label="Cancelled"
          value={cancelledOrders.length > 0 ? String(cancelledOrders.length) : '—'}
          delta={orders.length > 0 ? `${cancelRate}% of total` : 'No orders'}
          deltaDown={cancelledOrders.length > 0}
          spark={countBuckets}
        />
      </div>

      {/* Live orders strip — today only */}
      {range === 'today' && (
        <div className="min-w-0 bg-paper border border-paper-3 rounded-3 p-5 mb-6">
          <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
            Live orders
          </h2>
          <div className="text-body-sm text-ink-6 mb-3">
            {todayOrders.filter(o => ACTIVE_STAGES.includes(o.stage)).length} active
          </div>
          <LiveOrdersStrip restaurantId={restaurant.id} currency={restaurant.currency} />
        </div>
      )}

      {/* Activity chart — multi-day ranges */}
      {showChart && (
        <div className="min-w-0 bg-paper border border-paper-3 rounded-3 p-5 mb-6">
          <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
            Activity
          </h2>
          <p className="text-body-sm text-ink-6 mb-4">
            Orders per day for {periodLabel.toLowerCase()}.
          </p>
          {nonCancelledOrders.length === 0 ? (
            <p className="text-body-sm text-ink-6 py-4">No orders in this period.</p>
          ) : (
            <ActivityChart buckets={countBuckets} labels={chartLabels} n={countBuckets.length} />
          )}
        </div>
      )}

      {/* Orders table */}
      <div className="min-w-0 bg-paper border border-paper-3 rounded-3 overflow-hidden mb-8">
        <div className="min-w-0 overflow-x-auto">
          <div
            className="grid gap-4 px-5 py-3 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest min-w-[620px]"
            style={{ gridTemplateColumns: showDate ? '140px 60px 1fr 120px 100px 80px 100px' : '80px 60px 1fr 120px 100px 80px 100px' }}
          >
            <span>Time</span>
            <span>Table</span>
            <span>Items</span>
            <span>Status</span>
            <span>Order</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <Mascot pose="hello" theme="line" size={160} accessory="none" />
              <p className="text-body-sm text-ink-6 mt-2">No orders for this period.</p>
            </div>
          ) : (
            orders.map(order => {
              const isActive = ACTIVE_STAGES.includes(order.stage)
              return (
                <div
                  key={order.id}
                  className={`grid gap-4 px-5 py-3 border-b border-paper-3 items-center text-body-sm last:border-b-0 min-w-[620px] ${
                    order.stage === 'cancelled' ? 'opacity-40' : order.urgent ? 'bg-ember-wash' : ''
                  }`}
                  style={{ gridTemplateColumns: showDate ? '140px 60px 1fr 120px 100px 80px 100px' : '80px 60px 1fr 120px 100px 80px 100px' }}
                >
                  <span className="font-mono text-[12px] text-ink-6 truncate">{formatOrderTime(order.created_at, showDate)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-ink">{order.table_label}</span>
                    {order.urgent && <span className="text-[9px] font-bold text-ember">⚡</span>}
                  </div>
                  <span className="text-ink-5 truncate">{orderLinesSummary(order.order_items)}</span>
                  <StagePill stage={order.stage as OrderStage} />
                  <span className="font-mono text-[12px] text-ink-6">#{order.id.slice(-4).toUpperCase()}</span>
                  <span className="font-mono font-semibold text-ink text-right tabular-nums">{formatPriceExact(order.subtotal_cents, restaurant.currency)}</span>
                  {isActive ? (
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
                  ) : (
                    <span />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Tables section — always today */}
      {tables.length > 0 ? (
        <TablesSection
          tables={tables}
          tableStats={tableStats}
          activeTableLabels={activeTableLabels}
          currency={restaurant.currency}
        />
      ) : (
        <div className="bg-paper border border-paper-3 rounded-3 px-6 py-12 text-center">
          <p className="font-display text-[20px] font-[500] text-ink mb-1 font-optical">No tables yet</p>
          <p className="text-body-sm text-ink-5">
            Add tables from the kitchen display to start tracking occupancy and revenue.
          </p>
        </div>
      )}
    </>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div className="space-y-2">
          <Sk className="h-8 w-48" />
          <Sk className="h-4 w-40" />
        </div>
        <Sk className="h-8 w-48 rounded-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
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

      <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid gap-4 px-5 py-3.5 border-b border-paper-3 last:border-0 items-center min-w-[540px]" style={{ gridTemplateColumns: '80px 60px 1fr 120px 100px 80px' }}>
              <Sk className="h-4 w-12" />
              <Sk className="h-4 w-8" />
              <Sk className="h-4 w-4/5" />
              <Sk className="h-5 w-20 rounded-pill" />
              <Sk className="h-4 w-14" />
              <Sk className="h-4 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-7 lg:grid-cols-4">
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
        <div className="overflow-x-auto">
          <div className="px-5 py-2.5 border-b border-paper-3 min-w-[640px]">
            <Sk className="h-3 w-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid gap-4 px-5 py-3.5 border-b border-paper-3 last:border-b-0 items-center min-w-[640px]" style={{ gridTemplateColumns: '80px 60px 1fr 140px 140px 60px 90px' }}>
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
      </div>
    </>
  )
}
