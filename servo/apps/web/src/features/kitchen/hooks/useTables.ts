import { useEffect, useState, useCallback } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Database } from '@servo/types'
import { supabase } from '@/lib/supabase'
import { KITCHEN_FLOOR_NUDGE_EVENT, kitchenFloorNudgeChannelName } from '../liveChannel'

/** Disambiguate embed: `table_status` references `tables` via both `table_id` and `merged_into`. */
const TABLES_WITH_STATUS =
  '*, table_status!table_status_table_id_fkey(*)'

export interface Table {
  id: string
  restaurant_id: string
  label: string
  seats: number
  sort_order: number
  active: boolean
}

export interface TableStatus {
  table_id: string
  restaurant_id: string
  waiter_name: string | null
  merged_into: string | null
  notes: string | null
  updated_at: string
  cleared_at: string | null
  occupied_since: string | null
}

export interface TableWithStatus extends Table {
  status: TableStatus | null
  active_order_count: number
  active_order_stages: Record<string, number>
  /** True if any order exists for this table in the current session (any stage, including done). */
  has_session_order: boolean
  has_pending_call: boolean
  merged_secondary_ids: string[]
  merged_secondary_labels: string[]
}

interface RawTableRow {
  id: string
  restaurant_id: string
  label: string
  seats: number
  sort_order: number
  active: boolean
  /** PostgREST returns an object for one-to-one embeds (PK/FK); array for older clients. */
  table_status: TableStatus | TableStatus[] | null
}

type TableStatusPatch = { waiter_name?: string | null; merged_into?: string | null; notes?: string | null; cleared_at?: string | null; occupied_since?: string | null }

function embeddedTableStatus(row: RawTableRow): TableStatus | null {
  const e = row.table_status
  if (e == null) return null
  return Array.isArray(e) ? (e[0] ?? null) : e
}

/** Insert or patch one row; avoids PostgREST upsert edge cases with RLS / conflict resolution. */
export async function upsertTableStatus(
  tableId: string,
  restaurantId: string,
  patch: TableStatusPatch
): Promise<{ error: PostgrestError | null }> {
  const updated_at = new Date().toISOString()

  const { data: existing, error: readErr } = await supabase
    .from('table_status')
    .select('table_id')
    .eq('table_id', tableId)
    .maybeSingle()

  if (readErr) return { error: readErr }

  type StatusUpdate = Database['public']['Tables']['table_status']['Update']
  const updates: StatusUpdate = { updated_at }
  if ('waiter_name' in patch) updates.waiter_name = patch.waiter_name
  if ('merged_into' in patch) updates.merged_into = patch.merged_into
  if ('notes' in patch) updates.notes = patch.notes
  if ('cleared_at' in patch) updates.cleared_at = patch.cleared_at
  if ('occupied_since' in patch) updates.occupied_since = patch.occupied_since

  if (existing) {
    const { error } = await supabase.from('table_status').update(updates).eq('table_id', tableId)
    return { error }
  }

  type StatusInsert = Database['public']['Tables']['table_status']['Insert']
  const insert: StatusInsert = {
    table_id: tableId,
    restaurant_id: restaurantId,
    waiter_name: 'waiter_name' in patch ? patch.waiter_name ?? null : null,
    merged_into: 'merged_into' in patch ? patch.merged_into : null,
    notes: 'notes' in patch ? patch.notes ?? null : null,
    cleared_at: 'cleared_at' in patch ? patch.cleared_at ?? null : null,
    occupied_since: 'occupied_since' in patch ? patch.occupied_since ?? null : null,
    updated_at,
  }
  const { error } = await supabase.from('table_status').insert(insert)
  return { error }
}

export function useTables(restaurantId: string | undefined) {
  const [tables, setTables] = useState<TableWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!restaurantId) {
      setTables([])
      setLoading(false)
      return
    }

    const [tablesRes, ordersRes, allOrdersRes, callsRes] = await Promise.all([
      supabase
        .from('tables')
        .select(TABLES_WITH_STATUS)
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('sort_order'),
      supabase
        .from('orders')
        .select('table_label, stage')
        .eq('restaurant_id', restaurantId)
        .in('stage', ['received', 'cooking', 'ready']),
      // All orders in the last 48 h — used only to determine if a table has had any
      // activity in the current session (even when all orders are done).
      supabase
        .from('orders')
        .select('table_label, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('waiter_calls')
        .select('table_label')
        .eq('restaurant_id', restaurantId)
        .is('acknowledged_at', null),
    ])

    const tablesData = tablesRes.data
    const ordersData = ordersRes.data
    const allOrdersData = allOrdersRes.data
    const callsData = callsRes.data

    const pendingLabels = new Set(((callsData ?? []) as { table_label: string }[]).map(c => c.table_label))

    const stagesByLabel: Record<string, Record<string, number>> = {}
    for (const o of ((ordersData ?? []) as { table_label: string; stage: string }[])) {
      if (!stagesByLabel[o.table_label]) stagesByLabel[o.table_label] = {}
      stagesByLabel[o.table_label][o.stage] = (stagesByLabel[o.table_label][o.stage] ?? 0) + 1
    }

    // Group all recent orders by label for session-occupancy detection
    const recentOrdersByLabel: Record<string, { created_at: string }[]> = {}
    for (const o of ((allOrdersData ?? []) as { table_label: string; created_at: string }[])) {
      ;(recentOrdersByLabel[o.table_label] ??= []).push({ created_at: o.created_at })
    }

    const rows: TableWithStatus[] = ((tablesData ?? []) as unknown as RawTableRow[]).map(row => {
      const status = embeddedTableStatus(row)
      const stages = stagesByLabel[row.label] ?? {}
      const count = Object.values(stages).reduce((s, n) => s + n, 0)
      const recentOrders = recentOrdersByLabel[row.label] ?? []
      const clearedAt = status?.cleared_at ?? null
      const hasSessionOrder = recentOrders.some(o =>
        clearedAt === null || o.created_at > clearedAt
      )
      return {
        id: row.id,
        restaurant_id: row.restaurant_id,
        label: row.label,
        seats: row.seats,
        sort_order: row.sort_order,
        active: row.active,
        status,
        active_order_count: count,
        active_order_stages: { ...stages },
        has_session_order: hasSessionOrder,
        has_pending_call: pendingLabels.has(row.label),
        merged_secondary_ids: [],
        merged_secondary_labels: [],
      }
    })

    const idToRow = new Map(rows.map(r => [r.id, r]))
    for (const row of rows) {
      if (!row.status?.merged_into) continue
      const primary = idToRow.get(row.status.merged_into)
      if (!primary) continue
      primary.merged_secondary_ids.push(row.id)
      primary.merged_secondary_labels.push(row.label)
      for (const [stage, cnt] of Object.entries(stagesByLabel[row.label] ?? {})) {
        primary.active_order_stages[stage] = (primary.active_order_stages[stage] ?? 0) + cnt
        primary.active_order_count += cnt
      }
      if (row.has_pending_call) primary.has_pending_call = true
      if (row.has_session_order) primary.has_session_order = true
    }

    setTables(rows)
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase
      .channel(`tables-mgmt-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_status', filter: `restaurant_id=eq.${restaurantId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` }, refetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, refetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, refetch)
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [restaurantId, refetch])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase
      .channel(kitchenFloorNudgeChannelName(restaurantId))
      .on('broadcast', { event: KITCHEN_FLOOR_NUDGE_EVENT }, () => {
        void refetch()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [restaurantId, refetch])

  useEffect(() => {
    if (!restaurantId) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, 4000)

    function onVisible() {
      if (document.visibilityState === 'visible') void refetch()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refetch)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refetch)
    }
  }, [restaurantId, refetch])

  return { tables, loading, refetch }
}
