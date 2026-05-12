import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/features/auth/hooks/useSession'
import { useRestaurantMembership } from '../hooks/useRestaurantMembership'
import { useKitchenOrders } from '../hooks/useKitchenOrders'
import { KitchenTopBar } from '../components/KitchenTopBar'
import { LaneColumn } from '../components/LaneColumn'
import { TicketDrawer } from '../components/TicketDrawer'
import type { KitchenOrder } from '../hooks/useKitchenOrders'

const STAGES = ['received', 'cooking', 'ready', 'picked_up'] as const

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <div className="w-5 h-5 border-2 border-ink-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}

export default function KitchenPage() {
  const { user } = useSession()
  const { data: memberships, isLoading: memberLoading } = useRestaurantMembership(user?.id)

  // Use first membership
  const membership = memberships?.[0]
  const restaurant = membership?.restaurants

  const { orders, pulsingId, loading: ordersLoading } = useKitchenOrders(restaurant?.id)

  // Accepting orders — kept in sync via realtime on restaurants table
  const [accepting, setAccepting] = useState<boolean>(true)
  const acceptingRef = useRef(accepting)

  useEffect(() => {
    if (restaurant?.accepting_orders !== undefined) {
      setAccepting(restaurant.accepting_orders)
      acceptingRef.current = restaurant.accepting_orders
    }
  }, [restaurant?.accepting_orders])

  // Realtime: sync accepting_orders from other sessions
  useEffect(() => {
    if (!restaurant?.id) return
    const channel = supabase
      .channel(`restaurant-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurant.id}`,
        },
        payload => {
          const row = payload.new as { accepting_orders: boolean }
          setAccepting(row.accepting_orders)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id])

  // 1-second tick for timers
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Drawer
  const [selected, setSelected] = useState<KitchenOrder | null>(null)

  if (memberLoading || ordersLoading) return <Spinner />

  if (!restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <p className="text-body text-ink-6">No restaurant assigned to your account.</p>
      </div>
    )
  }

  const byStage = (stage: string) => orders.filter(o => o.stage === stage)

  return (
    <div className="flex flex-col h-dvh bg-ink overflow-hidden">
      <KitchenTopBar
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        accepting={accepting}
        orders={orders}
      />

      {/* Lane grid */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {STAGES.map(stage => (
          <LaneColumn
            key={stage}
            stage={stage}
            orders={byStage(stage)}
            pulsingId={pulsingId}
            tick={tick}
            onSelect={setSelected}
          />
        ))}
      </div>

      <TicketDrawer
        order={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
