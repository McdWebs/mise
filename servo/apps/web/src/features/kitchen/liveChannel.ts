import { supabase } from '@/lib/supabase'

/** Must match the topic used in `useKitchenOrders` realtime channel. */
export function kitchenLiveChannelName(restaurantId: string) {
  return `kitchen-${restaurantId}`
}

export const KITCHEN_ORDER_CREATED_EVENT = 'order_created' as const

/**
 * Lets the guest tab signal the kitchen tab to pull the new order.
 * Postgres `postgres_changes` is easy to misconfigure (publication, RLS, filters);
 * broadcast uses the same Realtime channel and works as long as Realtime is on.
 */
export function notifyKitchenOrderCreated(restaurantId: string, orderId: string): void {
  const ch = supabase.channel(kitchenLiveChannelName(restaurantId))
  const cleanup = () => {
    void supabase.removeChannel(ch)
  }
  const failSafe = window.setTimeout(cleanup, 3000)

  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      void ch
        .send({
          type: 'broadcast',
          event: KITCHEN_ORDER_CREATED_EVENT,
          payload: { order_id: orderId },
        })
        .finally(() => {
          window.clearTimeout(failSafe)
          cleanup()
        })
      return
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      window.clearTimeout(failSafe)
      cleanup()
    }
  })
}

/** Tables view + waiter strip both listen here (separate from order lane channel). */
export function kitchenFloorNudgeChannelName(restaurantId: string) {
  return `kitchen-floor-nudge-${restaurantId}`
}

export const KITCHEN_FLOOR_NUDGE_EVENT = 'floor_nudge' as const

/** Guest rings waiter → kitchen tables / call strip refetch without relying on postgres_changes. */
export function notifyKitchenFloorNudge(restaurantId: string): void {
  const ch = supabase.channel(kitchenFloorNudgeChannelName(restaurantId))
  const cleanup = () => {
    void supabase.removeChannel(ch)
  }
  const failSafe = window.setTimeout(cleanup, 3000)

  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      void ch
        .send({
          type: 'broadcast',
          event: KITCHEN_FLOOR_NUDGE_EVENT,
          payload: { source: 'waiter_call' },
        })
        .finally(() => {
          window.clearTimeout(failSafe)
          cleanup()
        })
      return
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      window.clearTimeout(failSafe)
      cleanup()
    }
  })
}
