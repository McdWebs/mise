import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrder } from '../hooks/useOrder'
import { OrderStatus } from '../components/OrderStatus'
import type { OrderItem } from '@servo/types'

interface OrderItemWithName extends OrderItem {
  itemName: string
}

export default function OrderStatusPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const tableLabel = searchParams.get('table') ?? 'T 1'

  const { order, isLoading: loadingOrder } = useOrder(orderId)

  // Fetch order items with item names joined
  const { data: items = [] } = useQuery<OrderItemWithName[]>({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name)')
        .eq('order_id', orderId!)
      if (error) throw error
      type RawRow = { menu_items: { name: string } | null } & Record<string, unknown>
      return ((data ?? []) as unknown as RawRow[]).map(row => ({
        id: row.id as string,
        order_id: row.order_id as string,
        menu_item_id: row.menu_item_id as string,
        quantity: row.quantity as number,
        modifiers: (row.modifiers as string[]) ?? [],
        unit_price_cents: row.unit_price_cents as number,
        created_at: row.created_at as string,
        itemName: row.menu_items?.name ?? 'Item',
      }))
    },
    enabled: Boolean(orderId),
  })

  if (loadingOrder || !order) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto border-x border-paper-3 min-h-dvh">
      <OrderStatus order={order} items={items} tableLabel={tableLabel} />
    </div>
  )
}
