import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FleetTenant {
  id: string
  name: string
  slug: string
  accepting_orders: boolean
  state: 'live' | 'paused'
  health: 'ok' | 'warn' | 'err'
  ordersToday: number
  revenueTodayCents: number
  lastSeenAt: string | null
  errors: number
  issue: string | null
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function computeHealth(tenant: FleetTenant): 'ok' | 'warn' | 'err' {
  // Not accepting orders = intentionally paused, no health signal
  if (!tenant.accepting_orders) return 'ok'
  // Live but zero orders and last seen a long time ago → warn
  if (tenant.ordersToday === 0 && tenant.lastSeenAt) {
    const hoursSinceLastSeen = (Date.now() - new Date(tenant.lastSeenAt).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastSeen > 4) return 'warn'
  }
  return 'ok'
}

export function useFleet() {
  return useQuery<FleetTenant[]>({
    queryKey: ['fleet'],
    queryFn: async () => {
      const since = startOfToday()

      // Fetch all restaurants (requires super_admin RLS bypass)
      const [{ data: restaurants, error: rErr }, { data: orders, error: oErr }] = await Promise.all([
        supabase.from('restaurants').select('id, name, slug, accepting_orders'),
        supabase
          .from('orders')
          .select('restaurant_id, subtotal_cents, updated_at')
          .gte('created_at', since)
          .neq('stage', 'cancelled'),
      ])

      if (rErr) throw rErr
      if (oErr) throw oErr

      // Aggregate orders per restaurant
      type OrderRow = { restaurant_id: string; subtotal_cents: number; updated_at: string }
      const statsByRestaurant = new Map<string, { count: number; revenue: number; lastAt: string | null }>()

      for (const o of (orders ?? []) as OrderRow[]) {
        const existing = statsByRestaurant.get(o.restaurant_id)
        const lastAt = existing?.lastAt
        statsByRestaurant.set(o.restaurant_id, {
          count: (existing?.count ?? 0) + 1,
          revenue: (existing?.revenue ?? 0) + o.subtotal_cents,
          lastAt: lastAt && lastAt > o.updated_at ? lastAt : o.updated_at,
        })
      }

      type RestaurantRow = { id: string; name: string; slug: string; accepting_orders: boolean }

      const tenants: FleetTenant[] = (restaurants as RestaurantRow[] ?? []).map(r => {
        const stats = statsByRestaurant.get(r.id) ?? { count: 0, revenue: 0, lastAt: null }
        const partial: FleetTenant = {
          id: r.id,
          name: r.name,
          slug: r.slug,
          accepting_orders: r.accepting_orders,
          state: r.accepting_orders ? 'live' : 'paused',
          health: 'ok',
          ordersToday: stats.count,
          revenueTodayCents: stats.revenue,
          lastSeenAt: stats.lastAt,
          errors: 0,
          issue: null,
        }
        partial.health = computeHealth(partial)
        return partial
      })

      return tenants
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2, // refresh every 2 minutes
  })
}
