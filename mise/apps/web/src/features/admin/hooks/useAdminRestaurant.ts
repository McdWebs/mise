import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminRestaurant {
  id: string
  name: string
  slug: string
  tagline: string | null
  currency: string
  accepting_orders: boolean
  suspended: boolean
}

export function useAdminRestaurant(userId: string | undefined) {
  return useQuery<AdminRestaurant | null>({
    queryKey: ['admin-restaurant', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_members')
        .select('restaurants(id, name, slug, tagline, currency, accepting_orders, suspended)')
        .eq('user_id', userId!)
        .limit(1)
        .single()
      if (error) throw error
      return (data as unknown as { restaurants: AdminRestaurant })?.restaurants ?? null
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  })
}
