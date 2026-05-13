import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@servo/types'

export function useRestaurant(slug: string) {
  return useQuery<Restaurant | null>({
    queryKey: ['restaurant', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 0,
    enabled: Boolean(slug),
  })
}
