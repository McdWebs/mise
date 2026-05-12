/** Joined shapes from Supabase selects on order_items */
export type OrderItemJoins = {
  menu_items: { name: string } | null
  restaurant_plans: { title: string } | null
}

export function orderLineDisplayName(item: OrderItemJoins): string {
  if (item.restaurant_plans?.title) return item.restaurant_plans.title
  return item.menu_items?.name ?? 'Item'
}

export function orderLinesSummary(
  items: ({ quantity: number } & OrderItemJoins)[]
): string {
  return items.map(i => `${orderLineDisplayName(i)} ×${i.quantity}`).join(', ')
}
