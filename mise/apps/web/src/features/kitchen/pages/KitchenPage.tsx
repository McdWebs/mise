import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useKitchenOrders } from '../hooks/useKitchenOrders'
import { KitchenTopBar } from '../components/KitchenTopBar'
import { LaneColumn } from '../components/LaneColumn'
import { TicketDrawer } from '../components/TicketDrawer'
import type { OrderStage } from '@mise/types'

const STAGES = ['received', 'cooking', 'ready', 'picked_up'] as const

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink">
      <div className="w-5 h-5 border-2 border-ink-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}

export default function KitchenPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()

  const { data: restaurant, isLoading: restaurantLoading } = useQuery({
    queryKey: ['kitchen-restaurant', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, accepting_orders')
        .eq('id', restaurantId!)
        .single()
      if (error) throw error
      return data as { id: string; name: string; slug: string; accepting_orders: boolean }
    },
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 60 * 5,
  })

  const { orders, pulsingId, loading: ordersLoading, applyOrderStage, applyOrderUrgent, restoreKitchenOrder } =
    useKitchenOrders(restaurantId)

  const [accepting, setAccepting] = useState<boolean>(true)
  const acceptingRef = useRef(accepting)

  useEffect(() => {
    if (restaurant?.accepting_orders !== undefined) {
      setAccepting(restaurant.accepting_orders)
      acceptingRef.current = restaurant.accepting_orders
    }
  }, [restaurant?.accepting_orders])

  useEffect(() => {
    if (!restaurant?.id) return
    const channel = supabase
      .channel(`restaurant-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurant.id}` },
        payload => {
          const row = payload.new as { accepting_orders: boolean }
          setAccepting(row.accepting_orders)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedOrder = selectedId ? orders.find(o => o.id === selectedId) ?? null : null

  async function moveOrderToStage(orderId: string, targetStage: (typeof STAGES)[number]) {
    const order = orders.find(o => o.id === orderId)
    if (!order || order.stage === targetStage) return
    const prevStage = order.stage as OrderStage
    applyOrderStage(orderId, targetStage)
    const { error } = await supabase.from('orders').update({ stage: targetStage }).eq('id', orderId)
    if (error) applyOrderStage(orderId, prevStage)
  }

  if (restaurantLoading || ordersLoading) return <Spinner />

  if (!restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <p className="text-body text-ink-6">Restaurant not found.</p>
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

      <div className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {STAGES.map(stage => (
          <LaneColumn
            key={stage}
            stage={stage}
            orders={byStage(stage)}
            pulsingId={pulsingId}
            tick={tick}
            onSelect={o => setSelectedId(o.id)}
            onDropOrder={(orderId, targetStage) => {
              void moveOrderToStage(orderId, targetStage as (typeof STAGES)[number])
            }}
          />
        ))}
      </div>

      <TicketDrawer
        order={selectedOrder}
        onClose={() => setSelectedId(null)}
        applyOrderStage={applyOrderStage}
        applyOrderUrgent={applyOrderUrgent}
        restoreKitchenOrder={restoreKitchenOrder}
      />
    </div>
  )
}
