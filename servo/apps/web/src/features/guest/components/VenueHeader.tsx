import type { Restaurant } from '@servo/types'
import { TableChip } from './TableChip'

interface VenueHeaderProps {
  restaurant: Restaurant
  tableLabel: string
}

export function VenueHeader({ restaurant, tableLabel }: VenueHeaderProps) {
  return (
    <div className="sticky top-0 z-[5] bg-paper px-5 pt-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-[500] tracking-[-0.01em] text-ink leading-tight font-optical truncate">
            {restaurant.name}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-herb-2 font-semibold">● Open</span>
            <span className="w-1 h-1 rounded-full bg-ink-7" />
            <span className="text-[12px] text-ink-6 truncate">{restaurant.tagline}</span>
          </div>
        </div>
        <TableChip label={tableLabel} />
      </div>
    </div>
  )
}
