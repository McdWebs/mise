import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { OrderStage } from '@mise/types'

export interface AdminOrder {
  id: string
  table_label: string
  stage: OrderStage
  subtotal_cents: number
  created_at: string
  updated_at: string
  order_items: {
    quantity: number
    menu_items: { name: string } | null
    restaurant_plans: { title: string } | null
  }[]
}

export function useAdminOrders(restaurantId: string | undefined, since: string) {
  return useQuery<AdminOrder[]>({
    queryKey: ['admin-orders', restaurantId, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, table_label, stage, subtotal_cents, created_at, updated_at, order_items(quantity, menu_items(name), restaurant_plans(title))'
        )
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AdminOrder[]
    },
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 60,
  })
}
