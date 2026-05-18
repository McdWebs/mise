import { useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrder } from '../hooks/useOrder'
import { useRestaurant } from '../hooks/useRestaurant'
import { useTableOrders } from '../hooks/useTableOrders'
import { useGuestTable } from '../hooks/useGuestTable'
import { OrderStatus } from '../components/OrderStatus'
import type { OrderItem } from '@mise/types'

const BG = { backgroundImage: 'url(/assets/pattern-tablecloth.svg)', backgroundRepeat: 'repeat' as const }

interface OrderItemWithName extends OrderItem {
  itemName: string
}

export default function OrderStatusPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>()
  const [searchParams] = useSearchParams()
  const tableLabel = searchParams.get('table') ?? 'T 1'
  const navigate = useNavigate()

  const { order, isLoading: loadingOrder } = useOrder(orderId)
  const { data: restaurant } = useRestaurant(slug ?? '')
  const { data: guestTable } = useGuestTable(restaurant?.id, tableLabel)
  const tableOrders = useTableOrders(restaurant?.id, order?.table_label ?? tableLabel, guestTable?.cleared_at)

  // When staff clear the table, cleared_at changes — send the guest back to the cover screen
  const initialClearedAt = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!guestTable) return
    if (initialClearedAt.current === undefined) {
      initialClearedAt.current = guestTable.cleared_at
      return
    }
    if (guestTable.cleared_at !== initialClearedAt.current) {
      navigate(`/r/${slug}?table=${encodeURIComponent(tableLabel)}`)
    }
  }, [guestTable?.cleared_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch order items with item names joined
  const { data: items = [] } = useQuery<OrderItemWithName[]>({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name), restaurant_plans(title)')
        .eq('order_id', orderId!)
      if (error) throw error
      type RawRow = {
        menu_items: { name: string } | null
        restaurant_plans: { title: string } | null
      } & Record<string, unknown>
      return ((data ?? []) as unknown as RawRow[]).map(row => ({
        id: row.id as string,
        order_id: row.order_id as string,
        menu_item_id: row.menu_item_id as string | null,
        restaurant_plan_id: row.restaurant_plan_id as string | null,
        quantity: row.quantity as number,
        modifiers: (row.modifiers as string[]) ?? [],
        unit_price_cents: row.unit_price_cents as number,
        created_at: row.created_at as string,
        itemName: row.restaurant_plans?.title ?? row.menu_items?.name ?? 'Item',
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
    <div className="relative min-h-dvh bg-paper" style={BG}>
      <div className="w-full max-w-[420px] mx-auto">
        <OrderStatus
          order={order}
          items={items}
          tableLabel={tableLabel}
          slug={slug ?? ''}
          currency={restaurant?.currency ?? 'USD'}
          tableOrders={tableOrders.data ?? []}
        />
      </div>
    </div>
  )
}
