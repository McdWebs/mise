import { useState } from 'react'
import { Users, User } from 'lucide-react'
import type { Restaurant } from '@mise/types'
import { TableChip } from './TableChip'

interface CoverScreenProps {
  restaurant: Restaurant
  tableLabel: string
  tableSeats: number
  onEnter: (seat: number | null) => void
}

export function CoverScreen({ restaurant, tableLabel, tableSeats, onEnter }: CoverScreenProps) {
  const [pickingSeat, setPickingSeat] = useState(false)
  const cols = tableSeats <= 4 ? 2 : tableSeats <= 9 ? 3 : 4

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-10 pb-8">

      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <img
          src="/assets/logo-mark.svg"
          alt=""
          width={30}
          height={30}
          className="rounded-2"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <span className="font-display text-[18px] font-[500] tracking-[-0.01em] text-ink font-optical">
          Mise
        </span>
      </div>

      {/* Venue info */}
      <div className="mb-auto">
        <p className="text-overline text-ink-6 uppercase tracking-[0.08em] mb-1.5">Welcome to</p>
        <h1 className="font-display text-[44px] font-[500] leading-[1.02] tracking-[-0.02em] text-ink mb-2 font-optical">
          {restaurant.name}
        </h1>
        {restaurant.tagline && (
          <p className="text-[15px] text-ink-5 mb-7 leading-relaxed">{restaurant.tagline}</p>
        )}
        <TableChip label={tableLabel} variant="light" />
      </div>

      {/* ── Bottom section ── */}
      {tableSeats <= 1 ? (
        /* Single-seat table — no choice needed */
        <div>
          <button
            onClick={() => onEnter(null)}
            className="w-full h-12 rounded-[10px] bg-ink text-paper text-[15px] font-semibold flex items-center justify-center transition-colors duration-hover hover:bg-ink-2 active:scale-[0.98] active:duration-press"
          >
            Start ordering
          </button>
          <p className="mt-3 text-center text-[12px] text-ink-6">
            You can call a server at any time.
          </p>
        </div>

      ) : pickingSeat ? (
        /* Seat picker — inline, no page change */
        <div>
          <p className="text-[13px] font-semibold text-ink-5 uppercase tracking-[0.07em] mb-3">
            Which seat are you at?
          </p>
          <div
            className="grid gap-2.5 mb-4"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: tableSeats }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => onEnter(n)}
                className="aspect-square flex items-center justify-center rounded-[14px] border-2 border-paper-3 bg-paper font-display text-[26px] font-[500] text-ink hover:border-saffron hover:bg-saffron/5 transition-all duration-hover active:scale-[0.95] active:duration-press font-optical"
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPickingSeat(false)}
            className="w-full text-center text-[13px] text-ink-5 hover:text-ink transition-colors duration-hover py-1"
          >
            ← Back
          </button>
        </div>

      ) : (
        /* Mode choice */
        <div>
          <p className="text-[13px] font-semibold text-ink-5 uppercase tracking-[0.07em] mb-3">
            How would you like to order?
          </p>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {/* Together */}
            <button
              onClick={() => onEnter(null)}
              className="flex flex-col items-start px-4 py-4 rounded-[16px] border-2 border-paper-3 bg-paper hover:border-saffron hover:bg-saffron/5 transition-all duration-hover active:scale-[0.98] active:duration-press text-left"
            >
              <span className="w-9 h-9 rounded-[10px] bg-saffron/10 flex items-center justify-center mb-3">
                <Users size={18} className="text-saffron-3" />
              </span>
              <p className="text-[14px] font-semibold text-ink leading-snug">Order together</p>
              <p className="text-[12px] text-ink-5 mt-0.5 leading-snug">One bill for the table</p>
            </button>

            {/* By seat */}
            <button
              onClick={() => setPickingSeat(true)}
              className="flex flex-col items-start px-4 py-4 rounded-[16px] border-2 border-paper-3 bg-paper hover:border-ink-3 hover:bg-ink/[0.03] transition-all duration-hover active:scale-[0.98] active:duration-press text-left"
            >
              <span className="w-9 h-9 rounded-[10px] bg-ink/[0.06] flex items-center justify-center mb-3">
                <User size={18} className="text-ink-4" />
              </span>
              <p className="text-[14px] font-semibold text-ink leading-snug">Order by seat</p>
              <p className="text-[12px] text-ink-5 mt-0.5 leading-snug">Your own order & bill</p>
            </button>
          </div>
          <p className="text-center text-[12px] text-ink-6">
            You can call a server at any time.
          </p>
        </div>
      )}
    </div>
  )
}
