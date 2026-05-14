import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAdminOrders } from '../hooks/useAdminOrders'
import { StagePill } from '../components/StagePill'
import { KpiTile } from '../components/KpiTile'
import { Sk } from '../components/Skeleton'
import { DatePicker } from '../components/DatePicker'
import { formatPrice, formatPriceExact } from '@/features/guest/utils/formatPrice'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import type { OrderStage } from '@mise/types'
import { orderLinesSummary } from '@/lib/orderLineLabel'

type Range = 'today' | '7d' | '30d' | 'custom'

const RANGE_LABELS: Record<Range, string> = {
  today:  'Today',
  '7d':   '7 days',
  '30d':  '30 days',
  custom: 'Custom',
}

function presetSince(range: Exclude<Range, 'custom'>): string {
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
  } else if (range === '7d') {
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dailyBuckets(orders: { created_at: string; subtotal_cents: number }[], n: number): { count: number[]; revenue: number[] } {
  const now = new Date()
  const count = Array<number>(n).fill(0)
  const revenue = Array<number>(n).fill(0)
  orders.forEach(o => {
    const dayAgo = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (dayAgo < n) {
      count[n - 1 - dayAgo]++
      revenue[n - 1 - dayAgo] += o.subtotal_cents
    }
  })
  return { count, revenue }
}

function hourlyBuckets(orders: { created_at: string; subtotal_cents: number }[], n = 12): { count: number[]; revenue: number[] } {
  const now = Date.now()
  const count = Array<number>(n).fill(0)
  const revenue = Array<number>(n).fill(0)
  orders.forEach(o => {
    const diffH = Math.floor((now - new Date(o.created_at).getTime()) / (1000 * 60 * 60))
    if (diffH < n) {
      count[n - 1 - diffH]++
      revenue[n - 1 - diffH] += o.subtotal_cents
    }
  })
  return { count, revenue }
}

function dayLabels(n: number): string[] {
  const labels: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(n <= 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : String(d.getDate()))
  }
  return labels
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

interface OrdersPageProps {
  restaurant: AdminRestaurant
}

export function OrdersPage({ restaurant }: OrdersPageProps) {
  const [range, setRange] = useState<Range>('today')
  const [customFrom, setCustomFrom] = useState(() => todayISO())
  const [customTo, setCustomTo]     = useState(() => todayISO())
  const [appliedFrom, setAppliedFrom] = useState(customFrom)
  const [appliedTo, setAppliedTo]     = useState(customTo)

  const since = useMemo(() => {
    if (range === 'custom') return `${appliedFrom}T00:00:00.000Z`
    return presetSince(range as Exclude<Range, 'custom'>)
  }, [range, appliedFrom])

  const until = useMemo(() => {
    if (range === 'custom') return `${appliedTo}T23:59:59.999Z`
    return undefined
  }, [range, appliedTo])

  const { data: orders = [], isLoading } = useAdminOrders(restaurant.id, since, until)

  const nonCancelledOrders = useMemo(() => orders.filter(o => o.stage !== 'cancelled'), [orders])
  const cancelledOrders    = useMemo(() => orders.filter(o => o.stage === 'cancelled'),  [orders])

  const totalRevenueCents = useMemo(() => nonCancelledOrders.reduce((s, o) => s + o.subtotal_cents, 0), [nonCancelledOrders])
  const avgTicketCents    = nonCancelledOrders.length > 0 ? Math.round(totalRevenueCents / nonCancelledOrders.length) : 0
  const cancelRate        = orders.length > 0 ? Math.round((cancelledOrders.length / orders.length) * 100) : 0

  const bucketCount = range === 'today' ? 12 : range === '7d' ? 7 : 30
  const { count: countBuckets, revenue: revBuckets } = useMemo(() => {
    if (range === 'today') return hourlyBuckets(nonCancelledOrders)
    if (range === 'custom') {
      const from = new Date(appliedFrom).getTime()
      const to   = new Date(appliedTo).getTime()
      const days = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1)
      const n    = Math.min(days, 90)
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
        const d = new Date(from)
        d.setDate(d.getDate() + i)
        return countBuckets.length <= 14
          ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : String(d.getDate())
      })
    }
    return dayLabels(bucketCount)
  }, [range, bucketCount, appliedFrom, countBuckets])

  const showDate = range !== 'today'

  const periodLabel = useMemo(() => {
    if (range === 'today')  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (range === '7d')     return 'Last 7 days'
    if (range === '30d')    return 'Last 30 days'
    if (appliedFrom === appliedTo) return new Date(appliedFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${new Date(appliedFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(appliedTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [range, appliedFrom, appliedTo])

  const showChart = range !== 'today' && (countBuckets.length > 1)

  return (
    <>
      {/* Header: title row; custom dates on their own row so the range tabs + export stay aligned */}
      <div className="mb-6 min-w-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] sm:text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
              Orders
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
            <DatePicker
              value={customFrom}
              max={customTo}
              onChange={v => setCustomFrom(v)}
              placeholder="From"
            />
            <span className="text-body-sm text-ink-6 hidden sm:inline">to</span>
            <DatePicker
              value={customTo}
              min={customFrom}
              max={todayISO()}
              onChange={v => setCustomTo(v)}
              placeholder="To"
            />
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

      {/* KPI row */}
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

      {/* Activity chart */}
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
      <div className="min-w-0 bg-paper border border-paper-3 rounded-3 overflow-hidden">
        <div className="min-w-0 overflow-x-auto">
          <div
            className="grid gap-4 px-5 py-3 border-b border-paper-3 text-overline text-ink-6 uppercase tracking-widest min-w-[540px]"
            style={{ gridTemplateColumns: showDate ? '140px 60px 1fr 120px 100px 80px' : '80px 60px 1fr 120px 100px 80px' }}
          >
            <span>Time</span>
            <span>Table</span>
            <span>Items</span>
            <span>Status</span>
            <span>Order</span>
            <span className="text-right">Total</span>
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="grid gap-4 px-5 py-3.5 items-center border-b border-paper-3 last:border-0 min-w-[540px]"
                  style={{ gridTemplateColumns: '80px 60px 1fr 120px 100px 80px' }}
                >
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
            <div className="px-5 py-10 text-center text-body-sm text-ink-6">
              No orders for this period.
            </div>
          ) : (
            orders.map(order => (
              <div
                key={order.id}
                className={`grid gap-4 px-5 py-3 border-b border-paper-3 items-center text-body-sm last:border-b-0 min-w-[540px] ${
                  order.stage === 'cancelled' ? 'opacity-40' : ''
                }`}
                style={{ gridTemplateColumns: showDate ? '140px 60px 1fr 120px 100px 80px' : '80px 60px 1fr 120px 100px 80px' }}
              >
                <span className="font-mono text-[12px] text-ink-6 truncate">
                  {formatOrderTime(order.created_at, showDate)}
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
      </div>
    </>
  )
}
