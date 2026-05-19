import { useQuery } from '@tanstack/react-query'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'

export interface DayBucket {
  date: string
  orders: number
  revenueILSCents: number
}

export interface HourBucket {
  hour: number
  orders: number
}

export interface MonthBucket {
  month: string
  label: string
  newVenues: number
  cumulative: number
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

export interface TopItem {
  name: string
  quantity: number
  revenueILSCents: number
  venueCount: number
}

export interface VenueBreakdown {
  orders: number
  revenueILSCents: number
  seatModeOrders: number
  hourly: HourBucket[]
  topItems: TopItem[]
}

export interface PlatformAnalytics {
  // Fleet — current state
  totalVenues: number
  liveVenues: number
  pausedVenues: number
  // Period KPIs
  orders: number
  revenueILSCents: number
  avgTicketILSCents: number
  cancelled: number
  activeVenues: number
  itemsSold: number
  waiterCalls: number
  seatModeOrders: number
  revenuePerActiveVenueCents: number
  aiConversations: number
  supportTicketsOpen: number
  supportTicketsClosed: number
  // Charts
  daily: DayBucket[]
  hourly: HourBucket[]
  topVenues: TopVenue[]
  topItems: TopItem[]
  venueGrowth: MonthBucket[]
  // Per-venue breakdown for drawer
  venueBreakdown: Record<string, VenueBreakdown>
  // FX
  ratesUpdatedAt: string | null
  rates: Record<string, number>
}

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
      let ordersQ = supabase
        .from('orders')
        .select('id, restaurant_id, subtotal_cents, stage, created_at, table_label')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
      if (until) ordersQ = ordersQ.lte('created_at', until)

      let waiterQ = supabase
        .from('waiter_calls')
        .select('*', { count: 'exact', head: true })
        .gte('called_at', since)
      if (until) waiterQ = waiterQ.lte('called_at', until)

      let aiQ = supabase
        .from('assistant_conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since)
      if (until) aiQ = aiQ.lte('created_at', until)

      let ticketsQ = supabase
        .from('support_tickets')
        .select('status')
        .gte('created_at', since)
      if (until) ticketsQ = ticketsQ.lte('created_at', until)

      const [
        { data: restaurants, error: rErr },
        { data: orders, error: oErr },
        { count: waiterCallCount },
        { count: aiConvCount },
        { data: ticketsData },
        ratesPayload,
      ] = await Promise.all([
        supabase.from('restaurants').select('id, name, slug, accepting_orders, currency, created_at'),
        ordersQ,
        waiterQ,
        aiQ,
        ticketsQ,
        fetch('https://open.er-api.com/v6/latest/ILS')
          .then(r => r.json())
          .catch(() => null) as Promise<{ rates: Record<string, number>; time_last_update_utc?: string } | null>,
      ])

      if (rErr) throw rErr
      if (oErr) throw oErr

      const rates: Record<string, number> = ratesPayload?.rates ?? {}
      const ratesUpdatedAt = ratesPayload?.time_last_update_utc ?? null
      const toILSCents = makeConverter(rates)

      type RestRow = { id: string; name: string; slug: string; accepting_orders: boolean; currency: string; created_at: string }
      type OrdRow  = { id: string; restaurant_id: string; subtotal_cents: number; stage: string; created_at: string; table_label: string }
      type TickRow = { status: string }

      const rests   = (restaurants ?? []) as RestRow[]
      const ords    = (orders      ?? []) as OrdRow[]
      const tickets = (ticketsData ?? []) as TickRow[]

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

      const revenueILSCents   = active.reduce((s, o) => s + orderToILS(o), 0)
      const avgTicketILSCents = active.length > 0 ? Math.round(revenueILSCents / active.length) : 0
      const activeVenueSet    = new Set(active.map(o => o.restaurant_id))
      const activeVenues      = activeVenueSet.size
      const seatModeOrders    = active.filter(o => o.table_label?.includes('· Seat')).length
      const revenuePerActiveVenueCents = activeVenues > 0 ? Math.round(revenueILSCents / activeVenues) : 0

      const waiterCalls        = waiterCallCount ?? 0
      const aiConversations    = aiConvCount ?? 0
      const supportTicketsOpen   = tickets.filter(t => t.status === 'open').length
      const supportTicketsClosed = tickets.filter(t => t.status === 'closed').length

      // ── Daily buckets ──────────────────────────────────────────────────────
      const bucketMap = new Map<string, { orders: number; revenueILSCents: number }>()
      for (const o of active) {
        const date = o.created_at.slice(0, 10)
        const ex = bucketMap.get(date) ?? { orders: 0, revenueILSCents: 0 }
        bucketMap.set(date, { orders: ex.orders + 1, revenueILSCents: ex.revenueILSCents + orderToILS(o) })
      }
      const fromDate = new Date(since.slice(0, 10) + 'T00:00:00')
      const toDate   = until ? new Date(until.slice(0, 10) + 'T00:00:00') : new Date()
      toDate.setHours(0, 0, 0, 0)
      const daily: DayBucket[] = []
      const cur = new Date(fromDate)
      while (cur <= toDate) {
        const d = cur.toISOString().slice(0, 10)
        daily.push({ date: d, ...(bucketMap.get(d) ?? { orders: 0, revenueILSCents: 0 }) })
        cur.setDate(cur.getDate() + 1)
      }

      // ── Hourly distribution (UTC) ──────────────────────────────────────────
      const hourMap: Record<number, number> = {}
      for (const o of active) {
        const h = new Date(o.created_at).getUTCHours()
        hourMap[h] = (hourMap[h] ?? 0) + 1
      }
      const hourly: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: hourMap[h] ?? 0 }))

      // ── Per-venue accumulator (for top venues + breakdown) ─────────────────
      const venueAccum = new Map<string, {
        orders: number
        revenueILSCents: number
        seatModeOrders: number
        hourMap: Record<number, number>
      }>()
      for (const o of active) {
        const ex = venueAccum.get(o.restaurant_id) ?? { orders: 0, revenueILSCents: 0, seatModeOrders: 0, hourMap: {} }
        ex.orders++
        ex.revenueILSCents += orderToILS(o)
        if (o.table_label?.includes('· Seat')) ex.seatModeOrders++
        const h = new Date(o.created_at).getUTCHours()
        ex.hourMap[h] = (ex.hourMap[h] ?? 0) + 1
        venueAccum.set(o.restaurant_id, ex)
      }

      const topVenues: TopVenue[] = [...venueAccum.entries()]
        .map(([id, s]) => {
          const r = restMap.get(id)
          return {
            id,
            name: r?.name ?? id,
            slug: r?.slug ?? '',
            currency: r?.currency ?? 'ILS',
            orders: s.orders,
            revenueILSCents: s.revenueILSCents,
            pctOfRevenue: revenueILSCents > 0 ? (s.revenueILSCents / revenueILSCents) * 100 : 0,
          }
        })
        .sort((a, b) => b.revenueILSCents - a.revenueILSCents)
        .slice(0, 5)

      // ── Fleet growth by month ─────────────────────────────────────────────
      const growthMap = new Map<string, number>()
      for (const r of rests) {
        const month = r.created_at.slice(0, 7)
        growthMap.set(month, (growthMap.get(month) ?? 0) + 1)
      }
      let cumulative = 0
      const venueGrowth: MonthBucket[] = [...growthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, newVenues]) => {
          cumulative += newVenues
          const [y, m] = month.split('-')
          const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          return { month, label, newVenues, cumulative }
        })

      // ── Order items (top items across fleet + per-venue) ──────────────────
      const activeIds = active.map(o => o.id)
      const orderIdToRestId = new Map(active.map(o => [o.id, o.restaurant_id]))

      let topItems: TopItem[] = []
      let itemsSold = 0
      const venueItemAccum = new Map<string, Map<string, { quantity: number; revenueILSCents: number }>>()

      if (activeIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, quantity, unit_price_cents, menu_items(name), restaurant_plans(title)')
          .in('order_id', activeIds.slice(0, 1000))

        if (itemsData) {
          type ItemRow = {
            order_id: string
            quantity: number
            unit_price_cents: number
            menu_items: { name: string } | null
            restaurant_plans: { title: string } | null
          }
          const globalItemMap = new Map<string, { quantity: number; revenueILSCents: number; venues: Set<string> }>()

          for (const row of itemsData as unknown as ItemRow[]) {
            const name = row.restaurant_plans?.title ?? row.menu_items?.name ?? 'Unknown'
            const restaurantId = orderIdToRestId.get(row.order_id) ?? ''
            const currency = restMap.get(restaurantId)?.currency ?? 'ILS'
            const revILS = toILSCents(row.unit_price_cents * row.quantity, currency)

            itemsSold += row.quantity

            const gEx = globalItemMap.get(name) ?? { quantity: 0, revenueILSCents: 0, venues: new Set<string>() }
            gEx.quantity += row.quantity
            gEx.revenueILSCents += revILS
            if (restaurantId) gEx.venues.add(restaurantId)
            globalItemMap.set(name, gEx)

            if (restaurantId) {
              const vMap = venueItemAccum.get(restaurantId) ?? new Map<string, { quantity: number; revenueILSCents: number }>()
              const vEx = vMap.get(name) ?? { quantity: 0, revenueILSCents: 0 }
              vEx.quantity += row.quantity
              vEx.revenueILSCents += revILS
              vMap.set(name, vEx)
              venueItemAccum.set(restaurantId, vMap)
            }
          }

          topItems = [...globalItemMap.entries()]
            .map(([name, s]) => ({ name, quantity: s.quantity, revenueILSCents: s.revenueILSCents, venueCount: s.venues.size }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10)
        }
      }

      // ── Build per-venue breakdown ──────────────────────────────────────────
      const venueBreakdown: Record<string, VenueBreakdown> = {}
      for (const [rid, acc] of venueAccum.entries()) {
        const vItems = venueItemAccum.get(rid)
        const vTopItems: TopItem[] = vItems
          ? [...vItems.entries()]
              .map(([name, s]) => ({ name, quantity: s.quantity, revenueILSCents: s.revenueILSCents, venueCount: 1 }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5)
          : []
        venueBreakdown[rid] = {
          orders: acc.orders,
          revenueILSCents: acc.revenueILSCents,
          seatModeOrders: acc.seatModeOrders,
          hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: acc.hourMap[h] ?? 0 })),
          topItems: vTopItems,
        }
      }

      return {
        totalVenues,
        liveVenues,
        pausedVenues,
        orders: active.length,
        revenueILSCents,
        avgTicketILSCents,
        cancelled,
        activeVenues,
        itemsSold,
        waiterCalls,
        seatModeOrders,
        revenuePerActiveVenueCents,
        aiConversations,
        supportTicketsOpen,
        supportTicketsClosed,
        daily,
        hourly,
        topVenues,
        topItems,
        venueGrowth,
        venueBreakdown,
        ratesUpdatedAt,
        rates,
      }
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  })
}
