import { useEffect, useState } from 'react'
import { LogOut, BellRing } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { OrderingToggle } from './OrderingToggle'
import type { KitchenOrder } from '../hooks/useKitchenOrders'

type KitchenView = 'orders' | 'tables'

function liveClock(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

interface KitchenTopBarProps {
  restaurantId: string
  restaurantName: string
  accepting: boolean
  orders: KitchenOrder[]
  view: KitchenView
  waiterCallCount: number
  onViewChange: (v: KitchenView) => void
}

export function KitchenTopBar({
  restaurantId,
  restaurantName,
  accepting,
  orders,
  view,
  waiterCallCount,
  onViewChange,
}: KitchenTopBarProps) {
  const [clock, setClock] = useState(liveClock)

  useEffect(() => {
    const id = setInterval(() => setClock(liveClock()), 30_000)
    return () => clearInterval(id)
  }, [])

  const counts = {
    received: orders.filter(o => o.stage === 'received').length,
    cooking:  orders.filter(o => o.stage === 'cooking').length,
    ready:    orders.filter(o => o.stage === 'ready').length,
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="flex items-center gap-4 px-4 h-12 bg-ink-2 border-b border-ink-3 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <img
          src="/assets/logo-mark-inverse.svg"
          alt=""
          width={20}
          height={20}
          className="rounded-1"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <span className="font-display text-[15px] font-[500] text-paper font-optical tracking-[-0.01em]">
          Servo
        </span>
      </div>

      <div className="w-px h-5 bg-ink-3" />

      {/* Venue */}
      <span className="text-body-sm text-ink-7 shrink-0">
        {restaurantName}
      </span>

      <div className="w-px h-5 bg-ink-3" />

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-ink-3 rounded-pill p-0.5 shrink-0">
        <button
          onClick={() => onViewChange('orders')}
          className={`px-3 py-0.5 rounded-pill text-[12px] font-medium transition-colors duration-hover ${
            view === 'orders'
              ? 'bg-paper text-ink'
              : 'text-ink-6 hover:text-paper'
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => onViewChange('tables')}
          className={`relative px-3 py-0.5 rounded-pill text-[12px] font-medium transition-colors duration-hover ${
            view === 'tables'
              ? 'bg-paper text-ink'
              : 'text-ink-6 hover:text-paper'
          }`}
        >
          Tables
          {waiterCallCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-ember text-paper text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {waiterCallCount}
            </span>
          )}
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Lane stats (only in orders view) */}
      {view === 'orders' && (
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-mono text-mono text-saffron tabular-nums">
            {counts.received}
          </span>
          <span className="font-mono text-mono text-honey tabular-nums">
            {counts.cooking}
          </span>
          <span className="font-mono text-mono text-herb tabular-nums">
            {counts.ready}
          </span>
        </div>
      )}

      {/* Waiter call count (only in tables view) */}
      {view === 'tables' && waiterCallCount > 0 && (
        <div className="flex items-center gap-1.5 text-ember shrink-0">
          <BellRing size={13} className="animate-pulse" />
          <span className="font-mono text-[12px] font-semibold tabular-nums">
            {waiterCallCount}
          </span>
        </div>
      )}

      <div className="w-px h-5 bg-ink-3" />

      {/* Clock */}
      <span className="font-mono text-mono text-ink-6 tabular-nums shrink-0">
        {clock}
      </span>

      <div className="w-px h-5 bg-ink-3" />

      {/* Ordering toggle */}
      <OrderingToggle restaurantId={restaurantId} accepting={accepting} />

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-7 h-7 flex items-center justify-center rounded-2 text-ink-6 hover:text-paper hover:bg-ink-3 transition-colors duration-hover"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </header>
  )
}
