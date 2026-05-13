import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { KITCHEN_FLOOR_NUDGE_EVENT, kitchenFloorNudgeChannelName } from '../liveChannel'

export interface WaiterCall {
  id: string
  restaurant_id: string
  table_label: string
  called_at: string
  acknowledged_at: string | null
}

function callsSignature(c: WaiterCall[]): string {
  return [...c]
    .map(x => `${x.id}\0${x.table_label}\0${x.called_at}\0${x.acknowledged_at ?? ''}`)
    .sort()
    .join('\n')
}

export function useWaiterCalls(restaurantId: string | undefined) {
  const [calls, setCalls] = useState<WaiterCall[]>([])

  const refetch = useCallback(async () => {
    if (!restaurantId) return
    const { data } = await supabase
      .from('waiter_calls')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('acknowledged_at', null)
      .order('called_at', { ascending: false })
    setCalls((data ?? []) as WaiterCall[])
  }, [restaurantId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase
      .channel(`waiter-calls-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void refetch()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [restaurantId, refetch])

  // Broadcast nudge (guest “call waiter”) — same pattern as kitchen orders.
  useEffect(() => {
    if (!restaurantId) return
    const rid = restaurantId
    const ch = supabase
      .channel(kitchenFloorNudgeChannelName(rid))
      .on('broadcast', { event: KITCHEN_FLOOR_NUDGE_EVENT }, () => {
        void refetch()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [restaurantId, refetch])

  // Polling + tab focus when postgres_changes / broadcast miss.
  useEffect(() => {
    if (!restaurantId) return
    const rid = restaurantId

    async function syncFromServer() {
      const { data } = await supabase
        .from('waiter_calls')
        .select('*')
        .eq('restaurant_id', rid)
        .is('acknowledged_at', null)
        .order('called_at', { ascending: false })
      const next = (data ?? []) as WaiterCall[]
      setCalls(prev => (callsSignature(prev) === callsSignature(next) ? prev : next))
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncFromServer()
    }, 3000)

    function onVisible() {
      if (document.visibilityState === 'visible') void syncFromServer()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', syncFromServer)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', syncFromServer)
    }
  }, [restaurantId])

  const acknowledgeCall = useCallback(async (id: string) => {
    setCalls(prev => prev.filter(c => c.id !== id))
    const { error } = await supabase
      .from('waiter_calls')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      console.error('[useWaiterCalls] acknowledgeCall', error.message)
    }
    await refetch()
  }, [refetch])

  const acknowledgeAllForTable = useCallback(async (tableLabel: string) => {
    if (!restaurantId) return
    setCalls(prev => prev.filter(c => c.table_label !== tableLabel))
    const { error } = await supabase
      .from('waiter_calls')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('table_label', tableLabel)
      .is('acknowledged_at', null)
    if (error) {
      console.error('[useWaiterCalls] acknowledgeAllForTable', error.message)
    }
    await refetch()
  }, [restaurantId, refetch])

  return { calls, refetch, acknowledgeCall, acknowledgeAllForTable }
}
