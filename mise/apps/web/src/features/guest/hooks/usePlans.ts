import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface RestaurantPlan {
  id: string
  title: string
  description: string | null
  price_cents: number
  includes: string[]
  start_time: string | null
  end_time: string | null
}

export function usePlans(restaurantId: string | undefined) {
  return useQuery<RestaurantPlan[]>({
    queryKey: ['plans', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_plans')
        .select('id, title, description, price_cents, includes, start_time, end_time')
        .eq('restaurant_id', restaurantId!)
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as RestaurantPlan[]
    },
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 60,
  })
}
