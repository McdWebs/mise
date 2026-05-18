import { useMemo, useState } from 'react'
import { usePlatformAnalytics } from '../hooks/usePlatformAnalytics'
import { usePlatformCurrency } from '../hooks/usePlatformCurrency'
import { DatePicker } from '@/features/admin/components/DatePicker'
import type { DayBucket, TopVenue } from '../hooks/usePlatformAnalytics'

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

// ─── Formatters ───────────────────────────────────────────────────────────────

function ilsToTarget(ilsCents: number, currency: string, rates: Record<string, number>): number {
  if (currency === 'ILS') return ilsCents
  const rate = rates[currency]
  if (!rate) return ilsCents
  return Math.round(ilsCents * rate)
}

function fmtRevenue(ilsCents: number, currency: string, rates: Record<string, number>): string {
  const cents = ilsToTarget(ilsCents, currency, rates)
  const amount = cents / 100
  const fmt = (n: number, digits = 0) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
  if (amount >= 1_000_000) return fmt(amount / 1_000_000, 1) + 'M'
  if (amount >= 10_000)    return fmt(amount / 1_000, 1) + 'k'
  return fmt(amount)
}

function fmtRevenueExact(ilsCents: number, currency: string, rates: Record<string, number>): string {
  const cents = ilsToTarget(ilsCents, currency, rates)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'saffron' | 'ember' | 'herb'
}) {
  const valueColor =
    accent === 'ember'    ? 'text-ember'
    : accent === 'saffron' ? 'text-saffron'
    : accent === 'herb'    ? 'text-herb'
    : 'text-ink'

  return (
    <div className="bg-paper border border-paper-3 rounded-3 p-4">
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-[28px] font-[500] tracking-[-0.02em] font-optical leading-none ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="text-body-sm text-ink-6 mt-1.5">{sub}</p>}
    </div>
  )
}

function BarChart({
  data,
  getVal,
  color,
  formatTip,
}: {
  data: DayBucket[]
  getVal: (d: DayBucket) => number
  color: string
  formatTip: (d: DayBucket) => string
}) {
  const values = data.map(getVal)
  const max = Math.max(...values, 1)

  // X-axis labels: first, middle, last
  const mid = Math.floor(data.length / 2)

  return (
    <div>
      <div className="flex items-end gap-[2px] h-20 mb-1.5">
        {data.map((d, i) => {
          const v = getVal(d)
          const h = Math.max((v / max) * 100, v > 0 ? 3 : 0)
          return (
            <div
              key={i}
              className="flex-1 min-w-0 group relative cursor-default"
              style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
            >
              <div
                className={`w-full rounded-t-[2px] transition-opacity duration-hover group-hover:opacity-70 ${color}`}
                style={{ height: `${h}%` }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-hover z-10 whitespace-nowrap">
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

function TopVenuesTable({ venues, currency, rates }: { venues: TopVenue[]; currency: string; rates: Record<string, number> }) {
  if (venues.length === 0) {
    return <p className="text-body-sm text-ink-6 py-4">No orders in this period.</p>
  }

  return (
    <div className="divide-y divide-paper-3">
      {venues.map((v, i) => (
        <div key={v.id} className="flex items-center gap-4 py-3">
          <span className="font-mono text-[13px] text-ink-7 w-5 shrink-0 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-ink truncate">{v.name}</div>
            <div className="font-mono text-[11px] text-ink-6 truncate">
              /{v.slug}
              {v.currency !== currency && (
                <span className="ml-1.5 px-1 py-0.5 bg-paper-2 rounded-[4px] text-ink-7">{v.currency}→{currency}</span>
              )}
            </div>
          </div>
          <div className="w-20 shrink-0">
            <div className="h-1 bg-paper-3 rounded-pill overflow-hidden">
              <div
                className="h-full bg-saffron rounded-pill"
                style={{ width: `${v.pctOfRevenue}%` }}
              />
            </div>
          </div>
          <span className="font-mono text-[13px] text-ink tabular-nums w-8 text-right shrink-0">
            {v.orders}
          </span>
          <span className="font-mono text-[13px] font-semibold text-ink tabular-nums w-24 text-right shrink-0">
            {fmtRevenueExact(v.revenueILSCents, currency, rates)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
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
  const [range, setRange]           = useState<Range>('today')
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

  const liveRatio = a.totalVenues > 0 ? Math.round((a.liveVenues / a.totalVenues) * 100) : 0
  const showChart = range !== 'today' && a.daily.length > 1

  const ratesNote = a.ratesUpdatedAt
    ? `Rates updated ${new Date(a.ratesUpdatedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Using fallback rates'

  return (
    <div>
      {/* Page header + range selector */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
              Analytics
            </h1>
            <div className="text-body-sm text-ink-6 mt-0.5">
              {periodLabel} · synced {lastSync}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Currency note */}
            <div className="text-right hidden sm:block">
              <div className="text-overline text-ink-6 uppercase tracking-widest">All amounts in {currency}</div>
              <div className="font-mono text-[11px] text-ink-7 mt-0.5">{ratesNote}</div>
            </div>

            {/* Range tabs */}
            <div className="flex items-center gap-1 rounded-2 bg-paper-2 p-1">
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

      {/* Period KPIs */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Period</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <KpiTile
          label="Orders"
          value={String(a.orders)}
          sub={`${a.cancelled} cancelled`}
        />
        <KpiTile
          label="Revenue"
          value={fmtRevenue(a.revenueILSCents, currency, rates)}
          sub={fmtRevenueExact(a.revenueILSCents, currency, rates)}
          accent="saffron"
        />
        <KpiTile
          label="Avg ticket"
          value={a.avgTicketILSCents > 0 ? fmtRevenueExact(a.avgTicketILSCents, currency, rates) : '—'}
          sub="per order"
        />
        <KpiTile
          label="Active venues"
          value={String(a.activeVenues)}
          sub={`of ${a.liveVenues} live`}
          accent={a.activeVenues > 0 ? 'herb' : undefined}
        />
      </div>

      {/* Fleet KPIs */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5 mt-5">Fleet</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <KpiTile label="Total venues" value={String(a.totalVenues)} />
        <KpiTile
          label="Live"
          value={String(a.liveVenues)}
          sub={`${liveRatio}% of fleet`}
          accent="herb"
        />
        <KpiTile
          label="Paused"
          value={String(a.pausedVenues)}
          accent={a.pausedVenues > 0 ? 'ember' : undefined}
        />
        <KpiTile
          label="Cancelled"
          value={String(a.cancelled)}
          sub={a.orders + a.cancelled > 0 ? `${Math.round((a.cancelled / (a.orders + a.cancelled)) * 100)}% cancel rate` : undefined}
          accent={a.cancelled > 0 ? 'ember' : undefined}
        />
      </div>

      {/* Charts — hidden for today (no meaningful day-level chart) */}
      {showChart && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
          <div className="bg-paper border border-paper-3 rounded-3 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">
                Orders / day
              </h2>
              <span className="font-mono text-[13px] text-ink-6 tabular-nums">{a.orders} total</span>
            </div>
            <BarChart
              data={a.daily}
              getVal={d => d.orders}
              color="bg-ink-3"
              formatTip={d => `${d.orders} order${d.orders !== 1 ? 's' : ''}`}
            />
          </div>

          <div className="bg-paper border border-paper-3 rounded-3 p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">
                Revenue / day
              </h2>
              <span className="font-mono text-[13px] text-ink-6 tabular-nums">
                {fmtRevenue(a.revenueILSCents, currency, rates)} total
              </span>
            </div>
            <BarChart
              data={a.daily}
              getVal={d => d.revenueILSCents}
              color="bg-saffron"
              formatTip={d => fmtRevenueExact(d.revenueILSCents, currency, rates)}
            />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top venues */}
        <div className="col-span-1 lg:col-span-2 bg-paper border border-paper-3 rounded-3 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">
              Top venues
            </h2>
            <div className="flex gap-6 text-overline text-ink-6 uppercase tracking-widest text-[10px] pr-1">
              <span>Orders</span>
              <span>Revenue ({currency})</span>
            </div>
          </div>
          <TopVenuesTable venues={a.topVenues} currency={currency} rates={rates} />
        </div>

        {/* Fleet health */}
        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical mb-4">
            Fleet health
          </h2>

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
              { label: 'Total venues',  value: String(a.totalVenues) },
              { label: 'Active period', value: String(a.activeVenues) },
              { label: 'Idle period',   value: String(a.liveVenues - a.activeVenues) },
              { label: 'Orders',        value: String(a.orders) },
              { label: 'Revenue',       value: fmtRevenue(a.revenueILSCents, currency, rates) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-body-sm">
                <span className="text-ink-6">{label}</span>
                <span className="font-mono tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
