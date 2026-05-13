import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface MemberRestaurant {
  restaurant_id: string
  role: string
  restaurants: {
    id: string
    name: string
    slug: string
    accepting_orders: boolean
  }
}

export function useRestaurantMembership(userId: string | undefined) {
  return useQuery<MemberRestaurant[]>({
    queryKey: ['restaurant-membership', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_members')
        .select('restaurant_id, role, restaurants(id, name, slug, accepting_orders)')
        .eq('user_id', userId!)
      if (error) throw error
      return (data ?? []) as unknown as MemberRestaurant[]
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  })
}
