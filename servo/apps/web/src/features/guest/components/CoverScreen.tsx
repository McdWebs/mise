import type { Restaurant } from '@servo/types'
import { TableChip } from './TableChip'

interface CoverScreenProps {
  restaurant: Restaurant
  tableLabel: string
  onEnter: () => void
}

export function CoverScreen({ restaurant, tableLabel, onEnter }: CoverScreenProps) {
  return (
    <div className="relative min-h-dvh flex flex-col px-6 pt-12 pb-8">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 mb-10">
        <img
          src="/assets/logo-mark.svg"
          alt=""
          width={36}
          height={36}
          className="rounded-2"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <span className="font-display text-[20px] font-[500] tracking-[-0.01em] text-ink font-optical">
          Servo
        </span>
      </div>

      {/* Venue intro */}
      <p className="text-overline text-ink-6 uppercase tracking-[0.08em] mb-1.5">
        Welcome to
      </p>
      <h1 className="font-display text-[44px] font-[500] leading-[1.05] tracking-[-0.02em] text-ink mb-2 font-optical">
        {restaurant.name}
      </h1>
      <p className="text-[15px] text-ink-5 mb-7">{restaurant.tagline}</p>

      <TableChip label={tableLabel} variant="light" />

      {/* CTA pinned to bottom */}
      <div className="mt-auto pt-10">
        <button
          onClick={onEnter}
          className="w-full h-12 rounded-[10px] bg-ink text-paper text-[15px] font-semibold flex items-center justify-center transition-colors duration-hover hover:bg-ink-2 active:scale-[0.98] active:duration-press"
        >
          Start ordering
        </button>
        <p className="mt-3.5 text-center text-[12px] text-ink-6">
          You can call a server any time without ordering.
        </p>
      </div>
    </div>
  )
}
