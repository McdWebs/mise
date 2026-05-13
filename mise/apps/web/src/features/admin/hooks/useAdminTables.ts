import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminTable {
  id: string
  label: string
  seats: number
  sort_order: number
  waiter_name: string | null
  merged_into: string | null
  has_pending_call: boolean
}

interface RawRow {
  id: string
  label: string
  seats: number
  sort_order: number
  table_status:
    | { waiter_name: string | null; merged_into: string | null }
    | { waiter_name: string | null; merged_into: string | null }[]
    | null
}

function adminEmbeddedStatus(
  row: RawRow
): { waiter_name: string | null; merged_into: string | null } | null {
  const e = row.table_status
  if (e == null) return null
  return Array.isArray(e) ? (e[0] ?? null) : e
}

export function useAdminTables(restaurantId: string | undefined) {
  return useQuery<AdminTable[]>({
    queryKey: ['admin-tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      /** Same disambiguation as kitchen `useTables`: two FKs from `table_status` to `tables` (`table_id`, `merged_into`). */
      const tablesSelect =
        'id, label, seats, sort_order, table_status!table_status_table_id_fkey(waiter_name, merged_into)'

      const [tablesRes, callsRes] = await Promise.all([
        supabase
          .from('tables')
          .select(tablesSelect)
          .eq('restaurant_id', restaurantId)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('waiter_calls')
          .select('table_label')
          .eq('restaurant_id', restaurantId)
          .is('acknowledged_at', null),
      ])

      if (tablesRes.error) throw tablesRes.error
      if (callsRes.error) throw callsRes.error

      const tablesData = tablesRes.data
      const callsData = callsRes.data

      const pendingLabels = new Set((callsData ?? []).map(c => c.table_label as string))

      return ((tablesData ?? []) as unknown as RawRow[]).map(row => {
        const status = adminEmbeddedStatus(row)
        return {
          id: row.id,
          label: row.label,
          seats: row.seats,
          sort_order: row.sort_order,
          waiter_name: status?.waiter_name ?? null,
          merged_into: status?.merged_into ?? null,
          has_pending_call: pendingLabels.has(row.label),
        }
      })
    },
    enabled: !!restaurantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
