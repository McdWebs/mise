import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { OrderStage } from '@mise/types'

export interface TableOrder {
  id: string
  stage: OrderStage
  subtotal_cents: number
  created_at: string
  items: {
    id: string
    quantity: number
    unit_price_cents: number
    modifiers: string[]
    itemName: string
  }[]
}

type RawOrder = {
  id: string
  stage: OrderStage
  subtotal_cents: number
  created_at: string
  order_items: {
    id: string
    quantity: number
    unit_price_cents: number
    modifiers: string[]
    menu_items: { name: string } | null
    restaurant_plans: { title: string } | null
  }[]
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useTableOrders(restaurantId: string | undefined, tableLabel: string | null, since?: string | null) {
  const queryClient = useQueryClient()
  const key = ['table-orders', restaurantId, tableLabel, since ?? null]

  const query = useQuery<TableOrder[]>({
    queryKey: key,
    queryFn: async () => {
      // Use cleared_at if provided (new guest after table turnover), otherwise start of today
      const lowerBound = since ?? startOfToday()
      // Match both the base label ("T 1") and any seat-specific variants ("T 1 · Seat N")
      const { data, error } = await supabase
        .from('orders')
        .select('id, stage, subtotal_cents, created_at, order_items(id, quantity, unit_price_cents, modifiers, menu_items(name), restaurant_plans(title))')
        .eq('restaurant_id', restaurantId!)
        .or(`table_label.eq.${tableLabel!},table_label.like.${tableLabel!} · Seat %`)
        .gte('created_at', lowerBound)
        .neq('stage', 'cancelled')
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as unknown as RawOrder[]).map(o => ({
        id: o.id,
        stage: o.stage,
        subtotal_cents: o.subtotal_cents,
        created_at: o.created_at,
        items: o.order_items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          modifiers: item.modifiers ?? [],
          itemName: item.restaurant_plans?.title ?? item.menu_items?.name ?? 'Item',
        })),
      }))
    },
    enabled: !!restaurantId && !!tableLabel,
    staleTime: 0,
  })

  // Realtime: refresh when any order for this table changes
  useEffect(() => {
    if (!restaurantId || !tableLabel) return
    const ch = supabase
      .channel(`table-orders-${restaurantId}-${tableLabel}-${since ?? 'today'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurantId, tableLabel, since]) // eslint-disable-line react-hooks/exhaustive-deps

  return query
}
