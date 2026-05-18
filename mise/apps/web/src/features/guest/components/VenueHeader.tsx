import { ClipboardList } from 'lucide-react'
import type { Restaurant } from '@mise/types'
import { TableChip } from './TableChip'

interface VenueHeaderProps {
  restaurant: Restaurant
  tableLabel: string
  seatNumber?: number | null
  /** Opens table orders sheet from the menu. */
  onMyOrders?: () => void
  orderCount?: number
  estimatedMinutes?: number
}

export function VenueHeader({ restaurant, tableLabel, seatNumber, onMyOrders, orderCount = 0, estimatedMinutes }: VenueHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] font-[500] tracking-[-0.01em] text-ink leading-tight font-optical truncate">
            {restaurant.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            {estimatedMinutes != null && (
              <>
                <span className="text-[12px] text-saffron-3 font-semibold shrink-0 tabular-nums">~{estimatedMinutes} min</span>
              </>
            )}
            {restaurant.tagline && (
              <>
                <span className="w-1 h-1 rounded-full bg-ink-7 shrink-0" />
                <span className="text-[12px] text-ink-6 truncate">{restaurant.tagline}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onMyOrders && (
            <button
              type="button"
              onClick={onMyOrders}
              aria-label={orderCount > 0 ? `My orders, ${orderCount} active` : 'My orders'}
              className="relative w-10 h-10 rounded-full border-2 border-paper-4 bg-paper text-ink flex items-center justify-center hover:bg-paper-2 transition-colors duration-hover"
            >
              <ClipboardList size={18} strokeWidth={1.75} />
              {orderCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-saffron text-paper text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {orderCount > 9 ? '9+' : orderCount}
                </span>
              )}
            </button>
          )}
          <TableChip label={tableLabel} />
          {seatNumber != null && (
            <span className="flex items-center h-7 px-2.5 rounded-full bg-saffron/10 border border-saffron/25 font-mono text-[11px] font-semibold text-saffron-3 tracking-wide whitespace-nowrap">
              Seat {seatNumber}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
