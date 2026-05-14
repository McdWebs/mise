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

export function useAdminRestaurant(slug: string | undefined) {
  return useQuery<AdminRestaurant | null>({
    queryKey: ['admin-restaurant', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, tagline, currency, accepting_orders, suspended, assistant_instructions')
        .eq('slug', slug!)
        .single()
      if (error) throw error
      return data as AdminRestaurant ?? null
    },
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  })
}
