import { useEffect, useState, useCallback } from 'react'
import { Minus, Plus, Loader2 } from 'lucide-react'
import { useCartStore, cartLineKey, type CartLine } from '../store/cartStore'
import { formatPriceExact } from '../utils/formatPrice'

interface CartSheetProps {
  restaurantId: string
  currency: string
  lines: CartLine[]
  restaurantName: string
  tableLabel: string
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
}

type TipOption = '0' | '10' | '15' | 'custom'

export function CartSheet({ restaurantId, currency, lines, restaurantName, tableLabel, onClose, onSubmit, submitting }: CartSheetProps) {
  const { removeLine, updateQuantity } = useCartStore()
  const [open, setOpen] = useState(false)
  const [tipOption, setTipOption] = useState<TipOption>('10')
  const [customTip, setCustomTip] = useState('')

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [handleClose])

  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)

  const tipPct =
    tipOption === '0' ? 0
    : tipOption === '10' ? 10
    : tipOption === '15' ? 15
    : Math.max(0, Math.min(100, Number(customTip) || 0))

  const tipCents = Math.round(subtotalCents * tipPct / 100)
  const totalCents = subtotalCents + tipCents

  const TIP_OPTIONS: { value: TipOption; label: string }[] = [
    { value: '0',  label: 'No tip'  },
    { value: '10', label: '10%'     },
    { value: '15', label: '15%'     },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center"
      style={{
        background: 'rgba(26,22,18,0.4)',
        opacity: open ? 1 : 0,
        transition: 'opacity 240ms ease',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[420px] bg-paper rounded-t-[16px] px-5 pb-5 pt-2 max-h-[88dvh] overflow-y-auto"
        style={{
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.2,0.8,0.2,1)',
          willChange: 'transform',
        }}
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

        {/* Line items */}
        <div className="divide-y divide-paper-3">
          {lines.map(line => {
            const lk = cartLineKey(line)
            return (
            <div key={lk} className="flex items-center gap-3 py-3">
              {/* Qty stepper */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateQuantity(restaurantId, lk, line.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-paper-4 flex items-center justify-center text-ink-5 hover:border-paper-3 hover:text-ink transition-colors duration-hover"
                  aria-label={`Remove one ${line.name}`}
                >
                  <Minus size={12} />
                </button>
                <span className="font-mono font-semibold text-ink w-4 text-center tabular-nums text-[14px]">
                  {line.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(restaurantId, lk, line.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-paper-4 flex items-center justify-center text-ink-5 hover:border-paper-3 hover:text-ink transition-colors duration-hover"
                  aria-label={`Add one ${line.name}`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Name + modifiers */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[14px] font-medium text-ink">{line.name}</p>
                  {line.kind === 'plan' && (
                    <span className="text-[10px] font-mono font-bold text-saffron uppercase tracking-widest bg-saffron/15 px-1.5 py-0.5 rounded-pill">
                      Plan
                    </span>
                  )}
                </div>
                {line.kind === 'plan' && line.detailLines.length > 0 && (
                  <p className="text-[12px] text-ink-6 mt-0.5 line-clamp-2">
                    {line.detailLines.join(' · ')}
                  </p>
                )}
                {line.kind === 'menu' && line.modifiers.length > 0 && (
                  <p className="text-[12px] text-ink-6 mt-0.5">{line.modifiers.join(', ')}</p>
                )}
              </div>

              {/* Line total */}
              <span className="font-mono text-[14px] font-semibold text-ink tabular-nums shrink-0">
                {formatPriceExact(line.unitPriceCents * line.quantity, currency)}
              </span>
            </div>
            )
          })}
        </div>

        {/* Tip selector */}
        <div className="pt-4 pb-2 border-t border-paper-3 mt-1">
          <p className="text-[13px] font-semibold text-ink mb-2.5">Add a tip</p>
          <div className="flex gap-1.5">
            {TIP_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTipOption(opt.value)}
                className={`flex-1 py-[7px] rounded-pill border border-[1.5px] text-[13px] font-medium transition-all duration-hover ${
                  tipOption === opt.value
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-paper text-ink border-paper-4 hover:border-paper-3'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {tipOption === 'custom' && (
            <div className="mt-2.5 flex items-center gap-2 border border-[1.5px] border-paper-4 rounded-2 px-3 py-2 focus-within:border-saffron transition-[border-color] duration-standard">
              <input
                type="number"
                min="0"
                max="100"
                value={customTip}
                onChange={e => setCustomTip(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-8 w-0"
              />
              <span className="text-[14px] text-ink-5 font-medium">%</span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="pt-3 pb-1 border-t border-paper-3">
          <div className="flex justify-between text-[14px] py-1">
            <span className="text-ink-5">Subtotal</span>
            <span className="font-mono tabular-nums">{formatPriceExact(subtotalCents, currency)}</span>
          </div>
          {tipCents > 0 && (
            <div className="flex justify-between text-[14px] py-1">
              <span className="text-ink-5">Tip ({tipPct}%)</span>
              <span className="font-mono tabular-nums">{formatPriceExact(tipCents, currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5 mt-1.5 border-t border-paper-3">
            <span className="text-[17px] font-bold text-ink">Total</span>
            <span className="font-mono text-[17px] font-bold tabular-nums">{formatPriceExact(totalCents, currency)}</span>
          </div>
        </div>

        {/* Send to kitchen */}
        {lines.length > 0 && (
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
                <span className="font-mono">{formatPriceExact(totalCents, currency)}</span>
              </>
            )}
          </button>
        )}

        <button
          onClick={handleClose}
          className="w-full h-12 mt-2 rounded-[10px] border border-[1.5px] border-paper-4 bg-transparent text-ink text-[15px] font-semibold transition-colors duration-hover hover:bg-paper-2 active:scale-[0.98] active:duration-press"
        >
          Keep browsing
        </button>
      </div>
    </div>
  )
}
