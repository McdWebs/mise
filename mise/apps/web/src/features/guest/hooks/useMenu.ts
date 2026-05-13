import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MenuCategory, MenuItem } from '@mise/types'

export interface CategoryWithItems extends MenuCategory {
  menu_items: MenuItem[]
}

/** PostgREST returns an array for 1-N embeds; Supabase's reverse-embed types infer a single row. */
function normalizeMenuItems(items: MenuItem | MenuItem[] | null | undefined): MenuItem[] {
  if (items == null) return []
  return Array.isArray(items) ? items : [items]
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
      return (data ?? []).map((row) => {
        const { menu_items, ...rest } = row
        return { ...rest, menu_items: normalizeMenuItems(menu_items) }
      })
    },
    staleTime: 1000 * 60 * 2,
    enabled: Boolean(restaurantId),
  })
}
