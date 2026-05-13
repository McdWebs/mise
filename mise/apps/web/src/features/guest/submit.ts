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
}

export interface SubmittedOrder {
  orderId: string
}

export async function submitOrder({
  restaurantId,
  tableLabel,
  lines,
}: SubmitOrderParams): Promise<SubmittedOrder> {
  if (lines.length === 0) throw new Error('Cart is empty.')

  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)

  // Insert the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_label: tableLabel,
      stage: 'received',
      subtotal_cents: subtotalCents,
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
