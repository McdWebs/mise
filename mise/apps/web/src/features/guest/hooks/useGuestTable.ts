import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GuestTable {
  id: string
  label: string
  seats: number
  cleared_at: string | null
}

async function fetchGuestTableByLabel(
  restaurantId: string,
  label: string
): Promise<GuestTable | null> {
  const { data } = await supabase
    .from('tables')
    .select('id, label, seats, table_status!table_status_table_id_fkey(cleared_at)')
    .eq('restaurant_id', restaurantId)
    .eq('label', label)
    .eq('active', true)
    .maybeSingle()
  if (!data) return null
  type Raw = { id: string; label: string; seats: number; table_status: { cleared_at: string | null } | { cleared_at: string | null }[] | null }
  const raw = data as unknown as Raw
  const status = Array.isArray(raw.table_status) ? raw.table_status[0] : raw.table_status
  return { id: raw.id, label: raw.label, seats: raw.seats, cleared_at: status?.cleared_at ?? null }
}

export function useGuestTable(restaurantId: string | undefined, tableLabel: string | null) {
  return useQuery<GuestTable | null>({
    queryKey: ['guest-table', restaurantId, tableLabel],
    queryFn: async () => {
      if (!restaurantId || !tableLabel) return null
      const trimmed = tableLabel.trim()
      if (!trimmed) return null

      const exact = await fetchGuestTableByLabel(restaurantId, trimmed)
      if (exact) return exact

      // Kitchen bulk-create default is prefix "T " + number → "T 1". URLs often use ?table=1 only.
      if (/^\d+$/.test(trimmed)) {
        const withDefaultPrefix = await fetchGuestTableByLabel(restaurantId, `T ${trimmed}`)
        if (withDefaultPrefix) return withDefaultPrefix
      }

      return null
    },
    enabled: !!restaurantId,
    staleTime: 0,
  })
}
