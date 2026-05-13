import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminPlan {
  id: string
  restaurant_id: string
  title: string
  description: string | null
  price_cents: number
  includes: string[]
  active: boolean
  sort_order: number
  start_time: string | null  // "HH:MM" or null = all day
  end_time: string | null
}

export function useAdminPlans(restaurantId: string | undefined) {
  return useQuery<AdminPlan[]>({
    queryKey: ['admin-plans', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_plans')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as AdminPlan[]
    },
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 30,
  })
}
