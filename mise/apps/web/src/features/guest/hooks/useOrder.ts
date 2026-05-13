import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Order } from '@mise/types'

export function useOrder(orderId: string | undefined) {
  const queryClient = useQueryClient()
  const [realtimeStage, setRealtimeStage] = useState<Order['stage'] | null>(null)

  const query = useQuery<Order | null>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: Boolean(orderId),
    staleTime: 0,
  })

  // Supabase Realtime — subscribe to changes on this specific order
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          const updated = payload.new as Order
          setRealtimeStage(updated.stage)
          queryClient.setQueryData<Order | null>(['order', orderId], old =>
            old ? { ...old, stage: updated.stage } : old
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, queryClient])

  const order = query.data
  const stage = realtimeStage ?? order?.stage ?? null

  return { ...query, order, stage }
}
