import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { CartLine } from '../store/cartStore'
import { formatPriceExact } from '../utils/formatPrice'

interface CartSheetProps {
  lines: CartLine[]
  restaurantName: string
  tableLabel: string
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
}

const SERVICE_RATE = 0.1

export function CartSheet({ lines, restaurantName, tableLabel, onClose, onSubmit, submitting }: CartSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)
  const serviceCents = Math.round(subtotalCents * SERVICE_RATE)
  const totalCents = subtotalCents + serviceCents

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center"
      style={{ background: 'rgba(26,22,18,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-paper rounded-t-[16px] px-5 pb-5 pt-2 max-h-[88dvh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3.5" />

        <h2 className="font-display text-[24px] font-[500] tracking-[-0.01em] text-ink font-optical">
          Your order
        </h2>
        <p className="text-[14px] text-ink-5 mt-1.5 mb-3">
          {tableLabel} · {restaurantName}
        </p>

        {/* Line items — receipt style */}
        <div className="divide-y divide-paper-3">
          {lines.map((line, i) => (
            <div key={`${line.menuItemId}-${i}`} className="flex gap-3 py-3">
              <span className="font-mono font-semibold text-ink-6 w-6 tabular-nums text-[14px]">
                {line.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-ink">{line.name}</p>
                {line.modifiers.length > 0 && (
                  <p className="text-[12px] text-ink-6 mt-0.5">{line.modifiers.join(', ')}</p>
                )}
              </div>
              <span className="font-mono text-[14px] font-semibold text-ink tabular-nums">
                {formatPriceExact(line.unitPriceCents * line.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="pt-3.5 pb-1">
          <div className="flex justify-between text-[14px] py-1">
            <span className="text-ink-5">Subtotal</span>
            <span className="font-mono tabular-nums">{formatPriceExact(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-[14px] py-1">
            <span className="text-ink-5">Service (10%)</span>
            <span className="font-mono tabular-nums">{formatPriceExact(serviceCents)}</span>
          </div>
          <div className="flex justify-between py-2.5 mt-1.5 border-t border-paper-3">
            <span className="text-[17px] font-bold text-ink">Total</span>
            <span className="font-mono text-[17px] font-bold tabular-nums">{formatPriceExact(totalCents)}</span>
          </div>
        </div>

        {/* Send to kitchen */}
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="w-full h-12 mt-2 rounded-[10px] bg-saffron text-paper text-[15px] font-semibold flex items-center justify-between px-5 transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center gap-2 mx-auto">
              <Loader2 size={16} className="animate-spin" />
              Sending…
            </span>
          ) : (
            <>
              <span>Send to kitchen</span>
              <span className="font-mono">{formatPriceExact(totalCents)}</span>
            </>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full h-12 mt-2 rounded-[10px] border border-[1.5px] border-paper-4 bg-transparent text-ink text-[15px] font-semibold transition-colors duration-hover hover:bg-paper-2 active:scale-[0.98] active:duration-press"
        >
          Keep browsing
        </button>
      </div>
    </div>
  )
}
