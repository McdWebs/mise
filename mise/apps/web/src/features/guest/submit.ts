import { supabase } from '@/lib/supabase'
import { notifyKitchenOrderCreated } from '@/features/kitchen/liveChannel'
import type { CartLine } from './store/cartStore'

// TODO: payments — integrate payment provider here before taking money live.
// The order should only be created in the DB once payment is confirmed (or
// on a pre-auth hold). For now orders are submitted directly without payment.

export interface SubmitOrderParams {
  restaurantId: string
  tableLabel: string
  lines: CartLine[]
  basePrepMinutes?: number
}

export interface SubmittedOrder {
  orderId: string
}

/**
 * Estimate ready time based on:
 *  - Owner-configured base prep time (default 12 min)
 *  - Active orders in queue (+2 min each)
 *  - Item count in this order (+1 min per item over 2)
 *  - Time-of-day multiplier (peak lunch/dinner = 1.3×, shoulders = 1.1×)
 */
function calcEstimatedReadyAt(activeOrderCount: number, itemCount: number, basePrepMinutes: number): string {
  const hour = new Date().getHours()
  const queueBonus = activeOrderCount * 2
  const itemBonus = Math.max(0, itemCount - 2)
  const isPeak = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)
  const isShoulder = (hour >= 7 && hour <= 9) || (hour >= 15 && hour <= 17)
  const multiplier = isPeak ? 1.3 : isShoulder ? 1.1 : 1.0
  const totalMs = Math.round((basePrepMinutes + queueBonus + itemBonus) * multiplier) * 60_000
  return new Date(Date.now() + totalMs).toISOString()
}

export async function submitOrder({
  restaurantId,
  tableLabel,
  lines,
  basePrepMinutes = 12,
}: SubmitOrderParams): Promise<SubmittedOrder> {
  if (lines.length === 0) throw new Error('Cart is empty.')

  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  // Count active orders in the kitchen queue to inform the estimate
  const { count: activeCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .in('stage', ['received', 'cooking'])

  const estimated_ready_at = calcEstimatedReadyAt(activeCount ?? 0, itemCount, basePrepMinutes)

  // Insert the order
  const { data: order, error: orderError } = await (supabase as any)
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_label: tableLabel,
      stage: 'received',
      subtotal_cents: subtotalCents,
      estimated_ready_at,
    })
    .select('id')
    .single()

  if (orderError || !order) throw orderError ?? new Error('Failed to create order.')

  // Insert all order lines (menu items and/or fixed plans)
  const { error: itemsError } = await supabase.from('order_items').insert(
    lines.map(l => {
      if (l.kind === 'plan') {
        return {
          order_id: order.id,
          menu_item_id: null,
          restaurant_plan_id: l.planId,
          quantity: l.quantity,
          modifiers: l.detailLines.length > 0 ? l.detailLines : l.modifiers,
          unit_price_cents: l.unitPriceCents,
        }
      }
      return {
        order_id: order.id,
        menu_item_id: l.menuItemId,
        restaurant_plan_id: null,
        quantity: l.quantity,
        modifiers: l.modifiers,
        unit_price_cents: l.unitPriceCents,
      }
    })
  )

  if (itemsError) throw itemsError

  notifyKitchenOrderCreated(restaurantId, order.id)

  return { orderId: order.id }
}
