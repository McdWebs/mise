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
  // Fleet — always current state
  totalVenues: number
  liveVenues: number
  pausedVenues: number
  // Period KPIs
  orders: number
  revenueILSCents: number
  avgTicketILSCents: number
  cancelled: number
  activeVenues: number
  // Daily chart buckets for the period
  daily: DayBucket[]
  // Top 5 venues by revenue in period
  topVenues: TopVenue[]
  // Exchange rates (ILS base)
  ratesUpdatedAt: string | null
  rates: Record<string, number>
}

// 1 ILS = rates[currency] of that currency → to convert X of currency → ILS: X / rates[currency]
function makeConverter(rates: Record<string, number>) {
  return function toILSCents(cents: number, currency: string): number {
    if (!currency || currency === 'ILS') return cents
    const rate = rates[currency]
    if (!rate) return cents
    return Math.round(cents / rate)
  }
}

export function usePlatformAnalytics(since: string, until?: string) {
  return useQuery<PlatformAnalytics>({
    queryKey: ['platform-analytics', since, until ?? 'now'],
    queryFn: async () => {
      let ordersQuery = supabase
        .from('orders')
        .select('restaurant_id, subtotal_cents, stage, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      if (until) ordersQuery = ordersQuery.lte('created_at', until)

      const [
        { data: restaurants, error: rErr },
        { data: orders, error: oErr },
        ratesPayload,
      ] = await Promise.all([
        supabase.from('restaurants').select('id, name, slug, accepting_orders, currency'),
        ordersQuery,
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

      function orderToILS(o: OrdRow): number {
        const currency = restMap.get(o.restaurant_id)?.currency ?? 'ILS'
        return toILSCents(o.subtotal_cents, currency)
      }

      const active    = ords.filter(o => o.stage !== 'cancelled')
      const cancelled = ords.filter(o => o.stage === 'cancelled').length

      const revenueILSCents    = active.reduce((s, o) => s + orderToILS(o), 0)
      const avgTicketILSCents  = active.length > 0 ? Math.round(revenueILSCents / active.length) : 0
      const activeVenues       = new Set(active.map(o => o.restaurant_id)).size

      // Daily buckets — group active orders by date
      const bucketMap = new Map<string, { orders: number; revenueILSCents: number }>()
      for (const o of active) {
        const date = o.created_at.slice(0, 10)
        const ex = bucketMap.get(date) ?? { orders: 0, revenueILSCents: 0 }
        bucketMap.set(date, { orders: ex.orders + 1, revenueILSCents: ex.revenueILSCents + orderToILS(o) })
      }

      // Build a contiguous date array from since → until (or today)
      const fromDate  = new Date(since.slice(0, 10) + 'T00:00:00')
      const toDate    = until ? new Date(until.slice(0, 10) + 'T00:00:00') : new Date()
      toDate.setHours(0, 0, 0, 0)

      const daily: DayBucket[] = []
      const cur = new Date(fromDate)
      while (cur <= toDate) {
        const dateStr = cur.toISOString().slice(0, 10)
        const b = bucketMap.get(dateStr) ?? { orders: 0, revenueILSCents: 0 }
        daily.push({ date: dateStr, ...b })
        cur.setDate(cur.getDate() + 1)
      }

      // Top 5 venues by revenue
      const venueMap = new Map<string, { orders: number; revenueILSCents: number }>()
      for (const o of active) {
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
            pctOfRevenue: revenueILSCents > 0 ? (stats.revenueILSCents / revenueILSCents) * 100 : 0,
          }
        })
        .sort((a, b) => b.revenueILSCents - a.revenueILSCents)
        .slice(0, 5)

      return {
        totalVenues,
        liveVenues,
        pausedVenues,
        orders: active.length,
        revenueILSCents,
        avgTicketILSCents,
        cancelled,
        activeVenues,
        daily,
        topVenues,
        ratesUpdatedAt,
        rates,
      }
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  })
}
