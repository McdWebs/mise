import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order, OrderItem } from '@servo/types'
import { playDing } from '../utils/timerUtils'

export interface KitchenOrder extends Order {
  order_items: (OrderItem & {
    menu_items: { name: string } | null
    restaurant_plans: { title: string; includes: string[] } | null
  })[]
}

// "Just done" lane shows picked_up orders from the last 15 minutes
const DONE_WINDOW_MS = 15 * 60 * 1000

export function useKitchenOrders(restaurantId: string | undefined) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [pulsingId, setPulsingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialLoad = useRef(true)

  // Initial fetch
  useEffect(() => {
    if (!restaurantId) return

    async function fetchOrders() {
      if (!restaurantId) return
      setLoading(true)
      const cutoff = new Date(Date.now() - DONE_WINDOW_MS).toISOString()

      // Fetch active orders + recently picked_up
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, menu_items(name), restaurant_plans(title, includes))')
        .eq('restaurant_id', restaurantId)
        .neq('stage', 'cancelled')
        .or(`stage.neq.picked_up,updated_at.gte.${cutoff}`)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOrders(data as unknown as KitchenOrder[])
      }
      setLoading(false)
      initialLoad.current = false
    }

    fetchOrders()
  }, [restaurantId])

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async payload => {
          const newOrder = payload.new as Order

          // Fetch with items
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*, menu_items(name), restaurant_plans(title, includes))')
            .eq('id', newOrder.id)
            .single()

          if (data) {
            const kitchenOrder = data as unknown as KitchenOrder
            setOrders(prev => [kitchenOrder, ...prev])
            // Pulse + ding only after initial load
            if (!initialLoad.current) {
              setPulsingId(kitchenOrder.id)
              playDing()
              setTimeout(() => setPulsingId(null), 2600)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async payload => {
          const updated = payload.new as Order

          // Remove from list if cancelled or picked_up past the window
          if (updated.stage === 'cancelled') {
            setOrders(prev => prev.filter(o => o.id !== updated.id))
            return
          }

          if (
            updated.stage === 'picked_up' &&
            Date.now() - new Date(updated.updated_at).getTime() > DONE_WINDOW_MS
          ) {
            setOrders(prev => prev.filter(o => o.id !== updated.id))
            return
          }

          setOrders(prev =>
            prev.map(o =>
              o.id === updated.id
                ? { ...o, ...updated }
                : o
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  return { orders, pulsingId, loading }
}
