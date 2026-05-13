import { useQuery } from '@tanstack/react-query'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'

export interface FleetTenant {
  id: string
  name: string
  slug: string
  accepting_orders: boolean
  suspended: boolean
  state: 'live' | 'paused' | 'suspended'
  health: 'ok' | 'warn' | 'err'
  ordersToday: number
  revenueTodayCents: number
  lastSeenAt: string | null
  errors: number
  issue: string | null
  unreadMessages: number
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function computeHealth(tenant: FleetTenant): 'ok' | 'warn' | 'err' {
  if (tenant.suspended) return 'err'
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
      const [{ data: restaurants, error: rErr }, { data: orders, error: oErr }, { data: unreadMsgs }] = await Promise.all([
        supabase.from('restaurants').select('id, name, slug, accepting_orders, suspended'),
        supabase
          .from('orders')
          .select('restaurant_id, subtotal_cents, updated_at')
          .gte('created_at', since)
          .neq('stage', 'cancelled'),
        supabase
          .from('support_messages')
          .select('restaurant_id')
          .eq('sender_role', 'owner')
          .is('read_at', null),
      ])

      if (rErr) throw rErr
      if (oErr) throw oErr

      // Unread support messages per restaurant
      const unreadByRestaurant = new Map<string, number>()
      for (const m of (unreadMsgs ?? []) as { restaurant_id: string }[]) {
        unreadByRestaurant.set(m.restaurant_id, (unreadByRestaurant.get(m.restaurant_id) ?? 0) + 1)
      }

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

      type RestaurantRow = { id: string; name: string; slug: string; accepting_orders: boolean; suspended: boolean }

      const tenants: FleetTenant[] = (restaurants as RestaurantRow[] ?? []).map(r => {
        const stats = statsByRestaurant.get(r.id) ?? { count: 0, revenue: 0, lastAt: null }
        const state: FleetTenant['state'] = r.suspended ? 'suspended' : r.accepting_orders ? 'live' : 'paused'
        const partial: FleetTenant = {
          id: r.id,
          name: r.name,
          slug: r.slug,
          accepting_orders: r.accepting_orders,
          suspended: r.suspended,
          state,
          health: 'ok',
          ordersToday: stats.count,
          revenueTodayCents: stats.revenue,
          lastSeenAt: stats.lastAt,
          errors: 0,
          issue: null,
          unreadMessages: unreadByRestaurant.get(r.id) ?? 0,
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
