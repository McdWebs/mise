import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminMenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price_cents: number
  available: boolean
  tags: string[]
  allergens: string[]
  sort_order: number
}

export interface AdminMenuCategory {
  id: string
  restaurant_id: string
  name: string
  sort_order: number
  menu_items: AdminMenuItem[]
}

export function useAdminMenu(restaurantId: string | undefined) {
  return useQuery<AdminMenuCategory[]>({
    queryKey: ['admin-menu', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*, menu_items(*)')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'menu_items' })
      if (error) throw error
      return (data ?? []) as unknown as AdminMenuCategory[]
    },
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 30,
  })
}
