import { useQuery } from '@tanstack/react-query'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'

export interface DayBucket {
  date: string
  orders: number
  revenueILSCents: number
}

export interface TopVenue {
  id: string
  name: string
  slug: string
  currency: string
  orders: number
  revenueILSCents: number
  pctOfRevenue: number
}

export interface PlatformAnalytics {
  totalVenues: number
  liveVenues: number
  pausedVenues: number
  ordersToday: number
  revenueILSTodayCents: number
  avgTicketILSCents: number
  cancelledToday: number
  ordersThisWeek: number
  revenueILSThisWeekCents: number
  ordersLast30: number
  revenueILSLast30Cents: number
  activeVenuesToday: number
  daily30: DayBucket[]
  topVenues: TopVenue[]
  ratesUpdatedAt: string | null
}

function isoForDaysAgo(n: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// 1 ILS = rates[currency] of that currency.
// So to convert X units of `currency` → ILS: X / rates[currency]
function makeConverter(rates: Record<string, number>) {
  return function toILSCents(cents: number, currency: string): number {
    if (!currency || currency === 'ILS') return cents
    const rate = rates[currency]
    if (!rate) return cents  // unknown currency — treat as ILS (safe fallback)
    return Math.round(cents / rate)
  }
}

export function usePlatformAnalytics() {
  return useQuery<PlatformAnalytics>({
    queryKey: ['platform-analytics'],
    queryFn: async () => {
      const since30   = isoForDaysAgo(29)
      const sinceToday = isoForDaysAgo(0)
      const sinceWeek  = isoForDaysAgo(6)

      // Fetch restaurants, orders and live exchange rates in parallel
      const [
        { data: restaurants, error: rErr },
        { data: orders, error: oErr },
        ratesPayload,
      ] = await Promise.all([
        supabase.from('restaurants').select('id, name, slug, accepting_orders, currency'),
        supabase
          .from('orders')
          .select('restaurant_id, subtotal_cents, stage, created_at')
          .gte('created_at', since30)
          .order('created_at', { ascending: true }),
        fetch('https://open.er-api.com/v6/latest/ILS')
          .then(r => r.json())
          .catch(() => null) as Promise<{ rates: Record<string, number>; time_last_update_utc?: string } | null>,
      ])

      if (rErr) throw rErr
      if (oErr) throw oErr

      const rates: Record<string, number> = ratesPayload?.rates ?? {}
      const ratesUpdatedAt = ratesPayload?.time_last_update_utc ?? null
      const toILSCents = makeConverter(rates)

      type RestRow = { id: string; name: string; slug: string; accepting_orders: boolean; currency: string }
      type OrdRow  = { restaurant_id: string; subtotal_cents: number; stage: string; created_at: string }

      const rests = (restaurants ?? []) as RestRow[]
      const ords  = (orders ?? []) as OrdRow[]

      const totalVenues  = rests.length
      const liveVenues   = rests.filter(r => r.accepting_orders).length
      const pausedVenues = totalVenues - liveVenues

      const restMap = new Map(rests.map(r => [r.id, r]))

      // Helper: convert an order row to ILS cents
      function orderToILS(o: OrdRow): number {
        const currency = restMap.get(o.restaurant_id)?.currency ?? 'ILS'
        return toILSCents(o.subtotal_cents, currency)
      }

      // Today
      const todayAll    = ords.filter(o => o.created_at >= sinceToday)
      const todayActive = todayAll.filter(o => o.stage !== 'cancelled')
      const ordersToday            = todayActive.length
      const cancelledToday         = todayAll.filter(o => o.stage === 'cancelled').length
      const revenueILSTodayCents   = todayActive.reduce((s, o) => s + orderToILS(o), 0)
      const avgTicketILSCents      = ordersToday > 0 ? Math.round(revenueILSTodayCents / ordersToday) : 0
      const activeVenuesToday      = new Set(todayActive.map(o => o.restaurant_id)).size

      // This week
      const weekActive               = ords.filter(o => o.created_at >= sinceWeek && o.stage !== 'cancelled')
      const ordersThisWeek           = weekActive.length
      const revenueILSThisWeekCents  = weekActive.reduce((s, o) => s + orderToILS(o), 0)

      // Last 30 days
      const last30Active        = ords.filter(o => o.stage !== 'cancelled')
      const ordersLast30        = last30Active.length
      const revenueILSLast30Cents = last30Active.reduce((s, o) => s + orderToILS(o), 0)

      // 30-day daily buckets
      const daily30: DayBucket[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayOrds = ords.filter(o => o.created_at.slice(0, 10) === dateStr && o.stage !== 'cancelled')
        daily30.push({
          date: dateStr,
          orders: dayOrds.length,
          revenueILSCents: dayOrds.reduce((s, o) => s + orderToILS(o), 0),
        })
      }

      // Top venues by ILS revenue today
      const venueMap = new Map<string, { orders: number; revenueILSCents: number }>()
      for (const o of todayActive) {
        const ex = venueMap.get(o.restaurant_id) ?? { orders: 0, revenueILSCents: 0 }
        venueMap.set(o.restaurant_id, {
          orders: ex.orders + 1,
          revenueILSCents: ex.revenueILSCents + orderToILS(o),
        })
      }

      const topVenues: TopVenue[] = [...venueMap.entries()]
        .map(([id, stats]) => {
          const r = restMap.get(id)
          return {
            id,
            name: r?.name ?? id,
            slug: r?.slug ?? '',
            currency: r?.currency ?? 'ILS',
            ...stats,
            pctOfRevenue: revenueILSTodayCents > 0
              ? (stats.revenueILSCents / revenueILSTodayCents) * 100
              : 0,
          }
        })
        .sort((a, b) => b.revenueILSCents - a.revenueILSCents)
        .slice(0, 5)

      return {
        totalVenues,
        liveVenues,
        pausedVenues,
        ordersToday,
        revenueILSTodayCents,
        avgTicketILSCents,
        cancelledToday,
        ordersThisWeek,
        revenueILSThisWeekCents,
        ordersLast30,
        revenueILSLast30Cents,
        activeVenuesToday,
        daily30,
        topVenues,
        ratesUpdatedAt,
      }
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  })
}
