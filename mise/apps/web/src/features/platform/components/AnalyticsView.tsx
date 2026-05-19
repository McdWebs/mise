import { useMemo, useState } from 'react'
import { X, MessageCircle, LifeBuoy, BellRing, ShoppingBag, Users, TrendingUp, ChevronRight } from 'lucide-react'
import { Mascot } from '@mise/ui'
import { usePlatformAnalytics } from '../hooks/usePlatformAnalytics'
import { usePlatformCurrency } from '../hooks/usePlatformCurrency'
import { DatePicker } from '@/features/admin/components/DatePicker'
import type { DayBucket, HourBucket, MonthBucket, TopVenue, TopItem, VenueBreakdown } from '../hooks/usePlatformAnalytics'

// ─── Range helpers ────────────────────────────────────────────────────────────

type Range = 'today' | '7d' | '30d' | 'custom'

const RANGE_LABELS: Record<Range, string> = {
  today:  'Today',
  '7d':   '7 days',
  '30d':  '30 days',
  custom: 'Custom',
}

function presetSince(range: Exclude<Range, 'custom'>): string {
  const d = new Date()
  if (range === 'today') { d.setHours(0, 0, 0, 0) }
  else if (range === '7d') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0) }
  else { d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

function todayISO(): string { return new Date().toISOString().slice(0, 10) }

// ─── Formatters ───────────────────────────────────────────────────────────────

function ilsToTarget(ilsCents: number, currency: string, rates: Record<string, number>): number {
  if (currency === 'ILS') return ilsCents
  const rate = rates[currency]
  return rate ? Math.round(ilsCents * rate) : ilsCents
}

function fmtRevenue(ilsCents: number, currency: string, rates: Record<string, number>): string {
  const cents = ilsToTarget(ilsCents, currency, rates)
  const amount = cents / 100
  const fmt = (n: number, d = 0) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
  if (amount >= 1_000_000) return fmt(amount / 1_000_000, 1) + 'M'
  if (amount >= 10_000)    return fmt(amount / 1_000, 1) + 'k'
  return fmt(amount)
}

function fmtRevenueExact(ilsCents: number, currency: string, rates: Record<string, number>): string {
  const cents = ilsToTarget(ilsCents, currency, rates)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function fmtHour(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'saffron' | 'ember' | 'herb'
}) {
  const valueColor = accent === 'ember' ? 'text-ember' : accent === 'saffron' ? 'text-saffron' : accent === 'herb' ? 'text-herb' : 'text-ink'
  return (
    <div className="bg-paper border border-paper-3 rounded-3 p-4">
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-[28px] font-[500] tracking-[-0.02em] font-optical leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-body-sm text-ink-6 mt-1.5">{sub}</p>}
    </div>
  )
}

function BarChart({ data, getVal, color, formatTip, xLabel }: {
  data: { label?: string }[]
  getVal: (d: unknown, i: number) => number
  color: string
  formatTip: (d: unknown, i: number) => string
  xLabel?: (i: number) => string | null
}) {
  const values = data.map((d, i) => getVal(d, i))
  const max = Math.max(...values, 1)
  return (
    <div>
      <div className="flex items-end gap-[2px] h-20 mb-1.5">
        {data.map((d, i) => {
          const v = getVal(d, i)
          const h = Math.max((v / max) * 100, v > 0 ? 3 : 0)
          return (
            <div key={i} className="flex-1 min-w-0 group relative cursor-default" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div className={`w-full rounded-t-[2px] transition-opacity duration-hover group-hover:opacity-70 ${color}`} style={{ height: `${h}%` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                <div className="bg-ink text-paper text-[11px] font-mono px-2 py-1 rounded-2 shadow-2">{formatTip(d, i)}</div>
              </div>
            </div>
          )
        })}
      </div>
      {xLabel && (
        <div className="flex justify-between">
          {data.map((_, i) => {
            const lbl = xLabel(i)
            return <span key={i} className={`font-mono text-[10px] text-ink-7 ${lbl ? '' : 'invisible'}`}>{lbl ?? '.'}</span>
          })}
        </div>
      )}
    </div>
  )
}

function DayBarChart({ data, getVal, color, formatTip }: {
  data: DayBucket[]
  getVal: (d: DayBucket) => number
  color: string
  formatTip: (d: DayBucket) => string
}) {
  const values = data.map(getVal)
  const max = Math.max(...values, 1)
  const mid = Math.floor(data.length / 2)
  return (
    <div>
      <div className="flex items-end gap-[2px] h-20 mb-1.5">
        {data.map((d, i) => {
          const v = getVal(d)
          const h = Math.max((v / max) * 100, v > 0 ? 3 : 0)
          return (
            <div key={i} className="flex-1 min-w-0 group relative cursor-default" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div className={`w-full rounded-t-[2px] transition-opacity duration-hover group-hover:opacity-70 ${color}`} style={{ height: `${h}%` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                <div className="bg-ink text-paper text-[11px] font-mono px-2 py-1 rounded-2 shadow-2">
                  <div className="text-ink-7 mb-0.5">{fmtDate(d.date)}</div>
                  {formatTip(d)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-ink-7">{data[0] ? fmtDate(data[0].date) : ''}</span>
        <span className="font-mono text-[10px] text-ink-7">{data[mid] ? fmtDate(data[mid].date) : ''}</span>
        <span className="font-mono text-[10px] text-ink-7">{data[data.length - 1] ? fmtDate(data[data.length - 1].date) : ''}</span>
      </div>
    </div>
  )
}

function HourlyChart({ data }: { data: HourBucket[] }) {
  const max = Math.max(...data.map(d => d.orders), 1)
  const peakHour = data.reduce((p, d) => d.orders > p.orders ? d : p, data[0])
  return (
    <div>
      <div className="flex items-end gap-[3px] h-16 mb-1.5">
        {data.map((d) => {
          const h = Math.max((d.orders / max) * 100, d.orders > 0 ? 4 : 0)
          const isPeak = d.hour === peakHour.hour && d.orders > 0
          return (
            <div key={d.hour} className="flex-1 min-w-0 group relative cursor-default" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div
                className={`w-full rounded-t-[2px] transition-opacity duration-hover group-hover:opacity-70 ${isPeak ? 'bg-saffron' : 'bg-ink-3'}`}
                style={{ height: `${h}%` }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                <div className="bg-ink text-paper text-[11px] font-mono px-2 py-1 rounded-2 shadow-2">
                  {fmtHour(d.hour)} · {d.orders} order{d.orders !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        {[0, 6, 12, 18, 23].map(h => (
          <span key={h} className="font-mono text-[10px] text-ink-7">{fmtHour(h)}</span>
        ))}
      </div>
    </div>
  )
}

function TopItemsTable({ items, currency, rates }: { items: TopItem[]; currency: string; rates: Record<string, number> }) {
  if (items.length === 0) return <p className="text-body-sm text-ink-6 py-4">No item data in this period.</p>
  const maxQty = Math.max(...items.map(i => i.quantity), 1)
  return (
    <div className="divide-y divide-paper-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <span className="font-mono text-[13px] text-ink-7 w-5 shrink-0 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-ink truncate">{item.name}</div>
            <div className="font-mono text-[11px] text-ink-6">{item.venueCount} venue{item.venueCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="w-16 shrink-0">
            <div className="h-1 bg-paper-3 rounded-pill overflow-hidden">
              <div className="h-full bg-herb rounded-pill" style={{ width: `${(item.quantity / maxQty) * 100}%` }} />
            </div>
          </div>
          <span className="font-mono text-[13px] text-ink tabular-nums w-10 text-right shrink-0">{fmtNum(item.quantity)}</span>
          <span className="font-mono text-[13px] font-semibold text-ink tabular-nums w-24 text-right shrink-0">
            {fmtRevenueExact(item.revenueILSCents, currency, rates)}
          </span>
        </div>
      ))}
    </div>
  )
}

function GrowthChart({ data }: { data: MonthBucket[] }) {
  if (data.length === 0) return <p className="text-body-sm text-ink-6 py-4">No data.</p>
  const max = Math.max(...data.map(d => d.cumulative), 1)
  return (
    <div>
      <div className="flex items-end gap-[3px] h-16 mb-1.5">
        {data.map((d, i) => {
          const h = Math.max((d.cumulative / max) * 100, 4)
          return (
            <div key={i} className="flex-1 min-w-0 group relative cursor-default" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div className="w-full rounded-t-[2px] bg-herb transition-opacity duration-hover group-hover:opacity-70" style={{ height: `${h}%` }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                <div className="bg-ink text-paper text-[11px] font-mono px-2 py-1 rounded-2 shadow-2">
                  <div className="text-ink-7 mb-0.5">{d.label}</div>
                  +{d.newVenues} · {d.cumulative} total
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-ink-7">{data[0]?.label}</span>
        {data.length > 2 && <span className="font-mono text-[10px] text-ink-7">{data[Math.floor(data.length / 2)]?.label}</span>}
        <span className="font-mono text-[10px] text-ink-7">{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}

function TopVenuesTable({ venues, currency, rates, onSelect }: {
  venues: TopVenue[]
  currency: string
  rates: Record<string, number>
  onSelect: (v: TopVenue) => void
}) {
  if (venues.length === 0) return <p className="text-body-sm text-ink-6 py-4">No orders in this period.</p>
  return (
    <div className="divide-y divide-paper-3">
      {venues.map((v, i) => (
        <button
          key={v.id}
          onClick={() => onSelect(v)}
          className="flex items-center gap-4 py-3 w-full text-left hover:bg-paper-2 -mx-1 px-1 rounded-2 transition-colors duration-hover group"
        >
          <span className="font-mono text-[13px] text-ink-7 w-5 shrink-0 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-ink truncate">{v.name}</div>
            <div className="font-mono text-[11px] text-ink-6 truncate">/{v.slug}</div>
          </div>
          <div className="w-20 shrink-0">
            <div className="h-1 bg-paper-3 rounded-pill overflow-hidden">
              <div className="h-full bg-saffron rounded-pill" style={{ width: `${v.pctOfRevenue}%` }} />
            </div>
          </div>
          <span className="font-mono text-[13px] text-ink tabular-nums w-8 text-right shrink-0">{v.orders}</span>
          <span className="font-mono text-[13px] font-semibold text-ink tabular-nums w-24 text-right shrink-0">
            {fmtRevenueExact(v.revenueILSCents, currency, rates)}
          </span>
          <ChevronRight size={14} className="text-ink-6 shrink-0 group-hover:text-ink transition-colors" />
        </button>
      ))}
    </div>
  )
}

// ─── Venue drawer ─────────────────────────────────────────────────────────────

function VenueDrawer({ venue, breakdown, currency, rates, onClose }: {
  venue: TopVenue
  breakdown: VenueBreakdown | undefined
  currency: string
  rates: Record<string, number>
  onClose: () => void
}) {
  const seatPct = breakdown && breakdown.orders > 0
    ? Math.round((breakdown.seatModeOrders / breakdown.orders) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-[420px] bg-paper border-l border-paper-3 shadow-2 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-paper-3 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <p className="font-display text-[20px] font-[500] text-ink tracking-[-0.01em] font-optical leading-tight truncate">{venue.name}</p>
            <p className="font-mono text-[12px] text-ink-6 mt-0.5">/{venue.slug}</p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-2 hover:bg-paper-2 text-ink-5 hover:text-ink transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Period stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-paper-2 rounded-3 p-3.5">
              <p className="text-overline text-ink-6 uppercase tracking-widest mb-1.5">Orders</p>
              <p className="font-display text-[26px] font-[500] text-ink tracking-[-0.02em] font-optical leading-none">{breakdown?.orders ?? 0}</p>
            </div>
            <div className="bg-paper-2 rounded-3 p-3.5">
              <p className="text-overline text-ink-6 uppercase tracking-widest mb-1.5">Revenue</p>
              <p className="font-display text-[26px] font-[500] text-saffron tracking-[-0.02em] font-optical leading-none">
                {breakdown ? fmtRevenue(breakdown.revenueILSCents, currency, rates) : '—'}
              </p>
            </div>
            <div className="bg-paper-2 rounded-3 p-3.5">
              <p className="text-overline text-ink-6 uppercase tracking-widest mb-1.5">Avg ticket</p>
              <p className="font-display text-[26px] font-[500] text-ink tracking-[-0.02em] font-optical leading-none">
                {breakdown && breakdown.orders > 0 ? fmtRevenue(Math.round(breakdown.revenueILSCents / breakdown.orders), currency, rates) : '—'}
              </p>
            </div>
            <div className="bg-paper-2 rounded-3 p-3.5">
              <p className="text-overline text-ink-6 uppercase tracking-widest mb-1.5">Seat mode</p>
              <p className="font-display text-[26px] font-[500] text-ink tracking-[-0.02em] font-optical leading-none">{seatPct}%</p>
              <p className="text-[11px] text-ink-6 mt-0.5">{breakdown?.seatModeOrders ?? 0} orders</p>
            </div>
          </div>

          {/* Hourly */}
          {breakdown && (
            <div>
              <p className="text-overline text-ink-6 uppercase tracking-widest mb-3">Orders by hour</p>
              <HourlyChart data={breakdown.hourly} />
            </div>
          )}

          {/* Top items */}
          {breakdown && breakdown.topItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-overline text-ink-6 uppercase tracking-widest">Top items</p>
                <div className="flex gap-5 text-[10px] text-ink-6 uppercase tracking-widest pr-1">
                  <span>Qty</span>
                  <span>Revenue ({currency})</span>
                </div>
              </div>
              <div className="divide-y divide-paper-3">
                {breakdown.topItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <span className="font-mono text-[12px] text-ink-7 w-4 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-ink truncate">{item.name}</span>
                    <span className="font-mono text-[12px] text-ink tabular-nums w-8 text-right shrink-0">{item.quantity}</span>
                    <span className="font-mono text-[12px] font-semibold text-ink tabular-nums w-20 text-right shrink-0">
                      {fmtRevenueExact(item.revenueILSCents, currency, rates)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <div className="h-3 bg-paper-3 rounded-2 w-20" />
            <div className="h-8 bg-paper-3 rounded-2 w-24" />
            <div className="h-3 bg-paper-3 rounded-2 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-paper border border-paper-3 rounded-3 p-5 h-48" />
        <div className="bg-paper border border-paper-3 rounded-3 p-5 h-48" />
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [range, setRange]             = useState<Range>('today')
  const [customFrom, setCustomFrom]   = useState(() => todayISO())
  const [customTo, setCustomTo]       = useState(() => todayISO())
  const [appliedFrom, setAppliedFrom] = useState(customFrom)
  const [appliedTo, setAppliedTo]     = useState(customTo)
  const [selectedVenue, setSelectedVenue] = useState<TopVenue | null>(null)

  const since = useMemo(() => {
    if (range === 'custom') return `${appliedFrom}T00:00:00.000Z`
    return presetSince(range as Exclude<Range, 'custom'>)
  }, [range, appliedFrom])

  const until = useMemo(() => {
    if (range === 'custom') return `${appliedTo}T23:59:59.999Z`
    return undefined
  }, [range, appliedTo])

  const { data: a, isLoading, dataUpdatedAt } = usePlatformAnalytics(since, until)
  const { currency } = usePlatformCurrency()
  const rates = a?.rates ?? {}

  const periodLabel = useMemo(() => {
    if (range === 'today')  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (range === '7d')     return 'Last 7 days'
    if (range === '30d')    return 'Last 30 days'
    if (appliedFrom === appliedTo) return new Date(appliedFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${new Date(appliedFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(appliedTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [range, appliedFrom, appliedTo])

  const lastSync = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  if (isLoading || !a) return <Skeleton />

  if (a.totalVenues === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] text-center">
      <Mascot pose="hello" theme="line" size={140} accessory="none" />
      <p className="text-body font-semibold text-ink mt-4">No venues yet</p>
      <p className="text-body-sm text-ink-6 mt-1">Add the first restaurant to start seeing analytics.</p>
    </div>
  )

  const liveRatio = a.totalVenues > 0 ? Math.round((a.liveVenues / a.totalVenues) * 100) : 0
  const showDayChart = range !== 'today' && a.daily.length > 1
  const showGrowth = a.venueGrowth.length > 1
  const peakHour = a.hourly.reduce((p, d) => d.orders > p.orders ? d : p, a.hourly[0])
  const cancelRate = a.orders + a.cancelled > 0 ? Math.round((a.cancelled / (a.orders + a.cancelled)) * 100) : 0
  const supportTotal = a.supportTicketsOpen + a.supportTicketsClosed

  const ratesNote = a.ratesUpdatedAt
    ? `Rates updated ${new Date(a.ratesUpdatedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Using fallback rates'

  return (
    <div>
      {/* Header + range selector */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">Analytics</h1>
            <div className="text-body-sm text-ink-6 mt-0.5">{periodLabel} · synced {lastSync}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="text-right hidden sm:block">
              <div className="text-overline text-ink-6 uppercase tracking-widest">All amounts in {currency}</div>
              <div className="font-mono text-[11px] text-ink-7 mt-0.5">{ratesNote}</div>
            </div>
            <div className="flex items-center gap-1 rounded-2 bg-paper-2 p-1">
              {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors duration-hover ${range === r ? 'bg-paper text-ink shadow-1' : 'text-ink-5 hover:text-ink'}`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <DatePicker value={customFrom} max={customTo} onChange={setCustomFrom} placeholder="From" />
            <span className="text-body-sm text-ink-6 hidden sm:inline">to</span>
            <DatePicker value={customTo} min={customFrom} max={todayISO()} onChange={setCustomTo} placeholder="To" />
            <button
              onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo) }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-2 bg-saffron text-paper text-body-sm font-semibold hover:bg-saffron-2 transition-colors duration-hover"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Period KPIs — row 1 */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Period</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <KpiTile label="Orders" value={String(a.orders)} sub={`${a.cancelled} cancelled`} />
        <KpiTile label="Revenue" value={fmtRevenue(a.revenueILSCents, currency, rates)} sub={fmtRevenueExact(a.revenueILSCents, currency, rates)} accent="saffron" />
        <KpiTile label="Avg ticket" value={a.avgTicketILSCents > 0 ? fmtRevenueExact(a.avgTicketILSCents, currency, rates) : '—'} sub="per order" />
        <KpiTile label="Active venues" value={String(a.activeVenues)} sub={`of ${a.liveVenues} live`} accent={a.activeVenues > 0 ? 'herb' : undefined} />
      </div>

      {/* Period KPIs — row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <KpiTile label="Items sold" value={fmtNum(a.itemsSold)} sub="line items" />
        <KpiTile label="Waiter calls" value={fmtNum(a.waiterCalls)} sub="nudges sent" accent={a.waiterCalls > 0 ? 'saffron' : undefined} />
        <KpiTile label="Seat-mode orders" value={fmtNum(a.seatModeOrders)} sub={a.orders > 0 ? `${Math.round((a.seatModeOrders / a.orders) * 100)}% of orders` : '—'} />
        <KpiTile label="Rev / venue" value={a.revenuePerActiveVenueCents > 0 ? fmtRevenue(a.revenuePerActiveVenueCents, currency, rates) : '—'} sub="active venue avg" accent="saffron" />
      </div>

      {/* Fleet KPIs */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Fleet</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <KpiTile label="Total venues" value={String(a.totalVenues)} />
        <KpiTile label="Live" value={String(a.liveVenues)} sub={`${liveRatio}% of fleet`} accent="herb" />
        <KpiTile label="Paused" value={String(a.pausedVenues)} accent={a.pausedVenues > 0 ? 'ember' : undefined} />
        <KpiTile label="Cancel rate" value={`${cancelRate}%`} sub={`${a.cancelled} cancelled`} accent={cancelRate > 10 ? 'ember' : undefined} />
      </div>

      {/* Day-level charts */}
      {showDayChart && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
          <div className="bg-paper border border-paper-3 rounded-3 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Orders / day</h2>
              <span className="font-mono text-[13px] text-ink-6 tabular-nums">{a.orders} total</span>
            </div>
            <DayBarChart data={a.daily} getVal={d => d.orders} color="bg-ink-3" formatTip={d => `${d.orders} order${d.orders !== 1 ? 's' : ''}`} />
          </div>
          <div className="bg-paper border border-paper-3 rounded-3 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Revenue / day</h2>
              <span className="font-mono text-[13px] text-ink-6 tabular-nums">{fmtRevenue(a.revenueILSCents, currency, rates)} total</span>
            </div>
            <DayBarChart data={a.daily} getVal={d => d.revenueILSCents} color="bg-saffron" formatTip={d => fmtRevenueExact(d.revenueILSCents, currency, rates)} />
          </div>
        </div>
      )}

      {/* Hourly distribution */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-7">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Orders by hour</h2>
          {a.orders > 0 && (
            <span className="font-mono text-[13px] text-ink-6">
              Peak {fmtHour(peakHour.hour)} · {peakHour.orders} order{peakHour.orders !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <HourlyChart data={a.hourly} />
      </div>

      {/* Top venues + Fleet health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-7">
        <div className="col-span-1 lg:col-span-2 bg-paper border border-paper-3 rounded-3 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Top venues</h2>
            <div className="flex gap-6 text-overline text-ink-6 uppercase tracking-widest text-[10px] pr-1">
              <span>Orders</span>
              <span>Revenue ({currency})</span>
            </div>
          </div>
          <TopVenuesTable venues={a.topVenues} currency={currency} rates={rates} onSelect={setSelectedVenue} />
        </div>

        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical mb-4">Fleet health</h2>
          <div className="mb-5">
            <div className="flex h-3 rounded-pill overflow-hidden gap-0.5 mb-2">
              <div className="bg-herb h-full" style={{ width: `${liveRatio}%` }} />
              <div className="bg-paper-3 h-full flex-1" />
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-herb font-medium">{a.liveVenues} live</span>
              <span className="text-ink-5">{a.pausedVenues} paused</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Total venues',   value: String(a.totalVenues) },
              { label: 'Active period',  value: String(a.activeVenues) },
              { label: 'Idle period',    value: String(a.liveVenues - a.activeVenues) },
              { label: 'Orders',         value: String(a.orders) },
              { label: 'Revenue',        value: fmtRevenue(a.revenueILSCents, currency, rates) },
              { label: 'Rev / venue',    value: a.revenuePerActiveVenueCents > 0 ? fmtRevenue(a.revenuePerActiveVenueCents, currency, rates) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-body-sm">
                <span className="text-ink-6">{label}</span>
                <span className="font-mono tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top items */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-7">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Top items across fleet</h2>
          <div className="flex gap-5 text-overline text-ink-6 uppercase tracking-widest text-[10px] pr-1">
            <span>Qty</span>
            <span>Revenue ({currency})</span>
          </div>
        </div>
        <TopItemsTable items={a.topItems} currency={currency} rates={rates} />
      </div>

      {/* Growth + AI & Support */}
      <div className={`grid grid-cols-1 gap-4 mb-7 ${showGrowth ? 'lg:grid-cols-2' : ''}`}>
        {showGrowth && (
          <div className="bg-paper border border-paper-3 rounded-3 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">Fleet growth</h2>
              <span className="font-mono text-[13px] text-ink-6 tabular-nums">{a.totalVenues} total</span>
            </div>
            <GrowthChart data={a.venueGrowth} />
          </div>
        )}

        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical mb-4">Engagement</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
              <div className="w-8 h-8 rounded-2 bg-saffron/10 flex items-center justify-center shrink-0">
                <MessageCircle size={15} className="text-saffron-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">AI assistant</p>
                <p className="text-[11px] text-ink-6">conversations started</p>
              </div>
              <span className="font-mono text-[18px] font-semibold text-ink tabular-nums">{fmtNum(a.aiConversations)}</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
              <div className="w-8 h-8 rounded-2 bg-ink/[0.06] flex items-center justify-center shrink-0">
                <BellRing size={15} className="text-ink-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">Waiter calls</p>
                <p className="text-[11px] text-ink-6">floor nudges in period</p>
              </div>
              <span className="font-mono text-[18px] font-semibold text-ink tabular-nums">{fmtNum(a.waiterCalls)}</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
              <div className="w-8 h-8 rounded-2 bg-ink/[0.06] flex items-center justify-center shrink-0">
                <Users size={15} className="text-ink-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">Seat-mode orders</p>
                <p className="text-[11px] text-ink-6">{a.orders > 0 ? `${Math.round((a.seatModeOrders / a.orders) * 100)}%` : '—'} of all orders</p>
              </div>
              <span className="font-mono text-[18px] font-semibold text-ink tabular-nums">{fmtNum(a.seatModeOrders)}</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
              <div className="w-8 h-8 rounded-2 bg-ink/[0.06] flex items-center justify-center shrink-0">
                <ShoppingBag size={15} className="text-ink-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink">Items sold</p>
                <p className="text-[11px] text-ink-6">total line items ordered</p>
              </div>
              <span className="font-mono text-[18px] font-semibold text-ink tabular-nums">{fmtNum(a.itemsSold)}</span>
            </div>

            {supportTotal > 0 && (
              <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
                <div className="w-8 h-8 rounded-2 bg-ink/[0.06] flex items-center justify-center shrink-0">
                  <LifeBuoy size={15} className="text-ink-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink">Support tickets</p>
                  <p className="text-[11px] text-ink-6">{a.supportTicketsClosed} closed · {a.supportTicketsOpen} open</p>
                </div>
                <div className="text-right">
                  <span className={`font-mono text-[18px] font-semibold tabular-nums ${a.supportTicketsOpen > 0 ? 'text-ember' : 'text-herb'}`}>
                    {a.supportTicketsOpen}
                  </span>
                  <p className="text-[10px] text-ink-6">open</p>
                </div>
              </div>
            )}

            {a.totalVenues > 0 && (
              <div className="flex items-center gap-3 p-3 bg-paper-2 rounded-3">
                <div className="w-8 h-8 rounded-2 bg-herb/10 flex items-center justify-center shrink-0">
                  <TrendingUp size={15} className="text-herb" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink">Conversion</p>
                  <p className="text-[11px] text-ink-6">venues with orders this period</p>
                </div>
                <span className="font-mono text-[18px] font-semibold text-ink tabular-nums">
                  {a.liveVenues > 0 ? `${Math.round((a.activeVenues / a.liveVenues) * 100)}%` : '—'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Venue drawer */}
      {selectedVenue && (
        <VenueDrawer
          venue={selectedVenue}
          breakdown={a.venueBreakdown[selectedVenue.id]}
          currency={currency}
          rates={rates}
          onClose={() => setSelectedVenue(null)}
        />
      )}
    </div>
  )
}
