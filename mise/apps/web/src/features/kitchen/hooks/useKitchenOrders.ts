import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, OrderStage } from '@mise/types'
import { playDing } from '../utils/timerUtils'
import { KITCHEN_ORDER_CREATED_EVENT, kitchenLiveChannelName } from '../liveChannel'

export interface KitchenOrder extends Order {
  order_items: (OrderItem & {
    menu_items: { name: string } | null
    restaurant_plans: { title: string; includes: string[] } | null
  })[]
}

// "Just done" lane shows picked_up orders from the last 15 minutes
const DONE_WINDOW_MS = 15 * 60 * 1000

/** Avoid embedding `restaurant_plans` — PostgREST 400s if FK/table is missing or schema cache is stale. */
const ORDER_SELECT_BASE =
  '*, order_items(*, menu_items(name))' as const

type RawKitchenItem = OrderItem & {
  menu_items: { name: string } | null
  restaurant_plans?: { title: string; includes: string[] } | null
}

type RawKitchenOrder = Order & { order_items: RawKitchenItem[] }

function mergeOrdersByCreatedAt(a: RawKitchenOrder[], b: RawKitchenOrder[]): RawKitchenOrder[] {
  const byId = new Map<string, RawKitchenOrder>()
  for (const o of b) byId.set(o.id, o)
  for (const o of a) byId.set(o.id, o)
  return [...byId.values()].sort(
    (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  )
}

async function fetchKitchenOrderById(orderId: string): Promise<RawKitchenOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT_BASE)
    .eq('id', orderId)
    .single()
  if (error || !data) return null
  return data as unknown as RawKitchenOrder
}

/**
 * Guest checkout inserts `orders` then `order_items` in separate requests.
 * Realtime can deliver the order INSERT before line items commit — retry briefly.
 */
async function fetchKitchenOrderWithLines(orderId: string): Promise<RawKitchenOrder | null> {
  const maxAttempts = 10
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = await fetchKitchenOrderById(orderId)
    if (!row) return null
    if (row.order_items?.length > 0) return row
    if (attempt < maxAttempts - 1) {
      await new Promise<void>(resolve => {
        setTimeout(resolve, 50 * (attempt + 1))
      })
    }
  }
  return fetchKitchenOrderById(orderId)
}

async function hydrateRestaurantPlans(orders: RawKitchenOrder[]) {
  const ids = new Set<string>()
  for (const o of orders) {
    for (const li of o.order_items) {
      if (li.restaurant_plan_id) ids.add(li.restaurant_plan_id)
    }
  }
  if (ids.size === 0) return

  const { data: plans, error } = await supabase
    .from('restaurant_plans')
    .select('id, title, includes')
    .in('id', [...ids])

  if (error || !plans?.length) return

  const byId = new Map(plans.map(p => [p.id, p]))
  for (const o of orders) {
    for (const li of o.order_items) {
      if (!li.restaurant_plan_id) continue
      const p = byId.get(li.restaurant_plan_id)
      if (p) li.restaurant_plans = { title: p.title, includes: p.includes }
    }
  }
}

async function loadKitchenOrdersFromDb(restaurantId: string): Promise<KitchenOrder[] | null> {
  const cutoff = new Date(Date.now() - DONE_WINDOW_MS).toISOString()

  const [pipe, done] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_SELECT_BASE)
      .eq('restaurant_id', restaurantId)
      .in('stage', ['received', 'cooking', 'ready'])
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select(ORDER_SELECT_BASE)
      .eq('restaurant_id', restaurantId)
      .eq('stage', 'picked_up')
      .filter('updated_at', 'gte', `"${cutoff}"`)
      .order('created_at', { ascending: false }),
  ])

  if (pipe.error || done.error) return null

  const merged = mergeOrdersByCreatedAt(
    (pipe.data ?? []) as unknown as RawKitchenOrder[],
    (done.data ?? []) as unknown as RawKitchenOrder[]
  )
  await hydrateRestaurantPlans(merged)
  return merged as unknown as KitchenOrder[]
}

function ordersSignature(list: KitchenOrder[]): string {
  return [...list]
    .map(o => `${o.id}\0${o.stage}\0${o.updated_at}`)
    .sort()
    .join('\n')
}

function sortOrdersKitchen(prev: KitchenOrder[]): KitchenOrder[] {
  return [...prev].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function useKitchenOrders(restaurantId: string | undefined) {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [pulsingId, setPulsingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialLoad = useRef(true)

  /** Instant UI: update local stage (or remove if cancelled). Server sync via Supabase + realtime. */
  function applyOrderStage(orderId: string, stage: OrderStage) {
    setOrders(prev => {
      if (stage === 'cancelled') return prev.filter(o => o.id !== orderId)
      const now = new Date().toISOString()
      return sortOrdersKitchen(
        prev.map(o => (o.id === orderId ? { ...o, stage, updated_at: now } : o))
      )
    })
  }

  /** Put an order back in the list (e.g. cancel failed). */
  function restoreKitchenOrder(order: KitchenOrder) {
    setOrders(prev => {
      if (prev.some(o => o.id === order.id)) {
        return prev.map(o => (o.id === order.id ? order : o))
      }
      return sortOrdersKitchen([order, ...prev])
    })
  }

  // Initial fetch
  useEffect(() => {
    if (!restaurantId) return

    let cancelled = false

    async function fetchOrders() {
      if (!restaurantId) return
      setLoading(true)
      const list = await loadKitchenOrdersFromDb(restaurantId)
      if (cancelled) return
      if (list) setOrders(list)
      setLoading(false)
      initialLoad.current = false
    }

    void fetchOrders()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  // Polling + tab focus: works even when postgres_changes replication is not delivered.
  useEffect(() => {
    if (!restaurantId) return
    const rid = restaurantId

    async function syncFromServer() {
      const list = await loadKitchenOrdersFromDb(rid)
      if (!list) return
      setOrders(prev => {
        if (ordersSignature(prev) === ordersSignature(list)) return prev
        if (!initialLoad.current) {
          const newOnes = list.filter(o => !prev.some(p => p.id === o.id))
          if (newOnes.length) {
            setPulsingId(newOnes[0].id)
            playDing()
            setTimeout(() => setPulsingId(null), 2600)
          }
        }
        return list
      })
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncFromServer()
    }, 3000)

    function onVisible() {
      if (document.visibilityState === 'visible') void syncFromServer()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', syncFromServer)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', syncFromServer)
    }
  }, [restaurantId])

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return

    async function ingestOrderById(orderId: string) {
      const row = await fetchKitchenOrderWithLines(orderId)
      if (!row) return
      await hydrateRestaurantPlans([row])
      const kitchenOrder = row as unknown as KitchenOrder
      setOrders(prev => {
        if (prev.some(o => o.id === kitchenOrder.id)) {
          return sortOrdersKitchen(
            prev.map(o => (o.id === kitchenOrder.id ? kitchenOrder : o))
          )
        }
        return sortOrdersKitchen([kitchenOrder, ...prev])
      })
      if (!initialLoad.current) {
        setPulsingId(kitchenOrder.id)
        playDing()
        setTimeout(() => setPulsingId(null), 2600)
      }
    }

    const channel = supabase
      .channel(kitchenLiveChannelName(restaurantId))
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
          await ingestOrderById(newOrder.id)
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
      .on('broadcast', { event: KITCHEN_ORDER_CREATED_EVENT }, ({ payload }) => {
        const orderId = (payload as { order_id?: unknown }).order_id
        if (typeof orderId === 'string') void ingestOrderById(orderId)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurantId])

  return { orders, pulsingId, loading, applyOrderStage, restoreKitchenOrder }
}
