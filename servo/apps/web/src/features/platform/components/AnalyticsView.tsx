import { usePlatformAnalytics } from '../hooks/usePlatformAnalytics'
import type { DayBucket, TopVenue } from '../hooks/usePlatformAnalytics'

// ─── Formatters (all amounts already in ILS) ─────────────────────────────────

function fmtILS(cents: number): string {
  const amount = cents / 100
  if (amount >= 1_000_000) return `₪${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 10_000)    return `₪${(amount / 1_000).toFixed(1)}k`
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtILSExact(cents: number): string {
  return `₪${(cents / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
      {/* X-axis: first, middle, last */}
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-ink-7">{data[0] ? fmtDate(data[0].date) : ''}</span>
        <span className="font-mono text-[10px] text-ink-7">{data[14] ? fmtDate(data[14].date) : ''}</span>
        <span className="font-mono text-[10px] text-ink-7">{data[29] ? fmtDate(data[29].date) : ''}</span>
      </div>
    </div>
  )
}

function TopVenuesTable({ venues, totalRevenue }: { venues: TopVenue[]; totalRevenue: number }) {
  if (venues.length === 0) {
    return <p className="text-body-sm text-ink-6 py-4">No orders recorded today.</p>
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
              {v.currency !== 'ILS' && (
                <span className="ml-1.5 px-1 py-0.5 bg-paper-2 rounded-[4px] text-ink-7">{v.currency}→ILS</span>
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
            {fmtILSExact(v.revenueILSCents)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-7">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <div className="h-3 bg-paper-3 rounded-2 w-20" />
            <div className="h-8 bg-paper-3 rounded-2 w-24" />
            <div className="h-3 bg-paper-3 rounded-2 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-paper border border-paper-3 rounded-3 p-5 h-48" />
        <div className="bg-paper border border-paper-3 rounded-3 p-5 h-48" />
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const { data: a, isLoading, dataUpdatedAt } = usePlatformAnalytics()

  const lastSync = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  if (isLoading || !a) return <Skeleton />

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
  const liveRatio = a.totalVenues > 0 ? Math.round((a.liveVenues / a.totalVenues) * 100) : 0

  const ratesNote = a.ratesUpdatedAt
    ? `Rates updated ${new Date(a.ratesUpdatedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Using fallback rates'

  return (
    <div>
      {/* Page header */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Analytics
          </h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            Today · {today} · synced {lastSync}
          </div>
        </div>
        {/* Currency note */}
        <div className="text-right">
          <div className="text-overline text-ink-6 uppercase tracking-widest">All amounts in ILS (₪)</div>
          <div className="font-mono text-[11px] text-ink-7 mt-0.5">{ratesNote}</div>
        </div>
      </div>

      {/* Today KPIs */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Today</p>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <KpiTile
          label="Orders today"
          value={String(a.ordersToday)}
          sub={`${a.cancelledToday} cancelled`}
        />
        <KpiTile
          label="Revenue today"
          value={fmtILS(a.revenueILSTodayCents)}
          sub={fmtILSExact(a.revenueILSTodayCents)}
          accent="saffron"
        />
        <KpiTile
          label="Avg ticket"
          value={a.avgTicketILSCents > 0 ? fmtILSExact(a.avgTicketILSCents) : '—'}
          sub="per order"
        />
        <KpiTile
          label="Active venues"
          value={String(a.activeVenuesToday)}
          sub={`of ${a.liveVenues} live`}
          accent={a.activeVenuesToday > 0 ? 'herb' : undefined}
        />
      </div>

      {/* Fleet KPIs */}
      <p className="text-overline text-ink-6 uppercase tracking-widest mb-2.5 mt-5">Fleet</p>
      <div className="grid grid-cols-4 gap-3 mb-7">
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
          label="This week"
          value={fmtILS(a.revenueILSThisWeekCents)}
          sub={`${a.ordersThisWeek} orders`}
          accent="saffron"
        />
      </div>

      {/* 30-day charts */}
      <div className="grid grid-cols-2 gap-4 mb-7">
        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">
              Orders / day
            </h2>
            <span className="font-mono text-[13px] text-ink-6 tabular-nums">{a.ordersLast30} total</span>
          </div>
          <BarChart
            data={a.daily30}
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
              {fmtILS(a.revenueILSLast30Cents)} total
            </span>
          </div>
          <BarChart
            data={a.daily30}
            getVal={d => d.revenueILSCents}
            color="bg-saffron"
            formatTip={d => fmtILSExact(d.revenueILSCents)}
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top venues */}
        <div className="col-span-2 bg-paper border border-paper-3 rounded-3 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-[18px] font-[500] text-ink tracking-[-0.005em] font-optical">
              Top venues today
            </h2>
            <div className="flex gap-6 text-overline text-ink-6 uppercase tracking-widest text-[10px] pr-1">
              <span>Orders</span>
              <span>Revenue (ILS)</span>
            </div>
          </div>
          <TopVenuesTable venues={a.topVenues} totalRevenue={a.revenueILSTodayCents} />
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
              { label: 'Total venues',      value: String(a.totalVenues) },
              { label: 'Active today',      value: String(a.activeVenuesToday) },
              { label: 'Idle today',        value: String(a.liveVenues - a.activeVenuesToday) },
              { label: 'Orders (30 days)',  value: String(a.ordersLast30) },
              { label: 'Revenue (30 days)', value: fmtILS(a.revenueILSLast30Cents) },
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
