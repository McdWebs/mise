import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuCategory, MenuItem } from '@servo/types'

export interface CategoryWithItems extends MenuCategory {
  menu_items: MenuItem[]
}

export function useMenu(restaurantId: string | undefined) {
  return useQuery<CategoryWithItems[]>({
    queryKey: ['menu', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*, menu_items(*)')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order', { ascending: true })
        .order('sort_order', { ascending: true, referencedTable: 'menu_items' })
      if (error) throw error
      return (data as CategoryWithItems[]) ?? []
    },
    staleTime: 1000 * 60 * 2,
    enabled: Boolean(restaurantId),
  })
}
