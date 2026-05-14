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
  assistant_instructions: string | null
}

export function useAdminRestaurant(userId: string | undefined, restaurantIdOverride?: string) {
  return useQuery<AdminRestaurant | null>({
    queryKey: ['admin-restaurant', userId, restaurantIdOverride],
    queryFn: async () => {
      if (restaurantIdOverride) {
        // Super admin viewing a specific restaurant by ID
        const { data, error } = await supabase
          .from('restaurants')
          .select('id, name, slug, tagline, currency, accepting_orders, suspended, assistant_instructions')
          .eq('id', restaurantIdOverride)
          .single()
        if (error) throw error
        return data as AdminRestaurant ?? null
      }
      // Normal owner path: look up via restaurant_members
      const { data, error } = await supabase
        .from('restaurant_members')
        .select('restaurants(id, name, slug, tagline, currency, accepting_orders, suspended, assistant_instructions)')
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
