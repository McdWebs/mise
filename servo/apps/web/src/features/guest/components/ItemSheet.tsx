import { useState, useEffect, useCallback } from 'react'
import type { MenuItem } from '@servo/types'
import { formatPrice, formatPriceExact } from '../utils/formatPrice'
import { QuantityStepper } from './QuantityStepper'
import { DietTag } from './DietTag'
import type { CartMenuLine } from '../store/cartStore'

interface ItemSheetProps {
  item: MenuItem
  currency: string
  onClose: () => void
  onAdd: (line: Omit<CartMenuLine, 'quantity'> & { quantity: number }) => void
}

export function ItemSheet({ item, currency, onClose, onAdd }: ItemSheetProps) {
  const [qty, setQty] = useState(1)
  const [request, setRequest] = useState('')
  const [open, setOpen] = useState(false)

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

  const lineTotalCents = item.price_cents * qty

  function handleAdd() {
    onAdd({
      kind: 'menu',
      menuItemId: item.id,
      name: item.name,
      unitPriceCents: item.price_cents,
      quantity: qty,
      modifiers: request.trim() ? [request.trim()] : [],
    })
    onClose()
  }

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
        aria-label={item.name}
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3.5" />

        {/* Name + price */}
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <h2 className="font-display text-[24px] font-[500] tracking-[-0.01em] text-ink leading-tight font-optical">
            {item.name}
          </h2>
          <span className="font-mono text-[18px] font-semibold text-ink tabular-nums shrink-0">
            {formatPrice(item.price_cents, currency)}
          </span>
        </div>

        {/* Description */}
        <p className="text-[14px] text-ink-5 leading-[1.5] mb-3">{item.description}</p>

        {/* Dietary tags */}
        {item.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {item.tags.map(tag => <DietTag key={tag} tag={tag} />)}
          </div>
        )}

        {/* Special requests */}
        <div className="border-t border-paper-3 pt-3.5 pb-3.5">
          <h4 className="text-[14px] font-semibold text-ink mb-2">Special requests</h4>
          <textarea
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder="e.g. no parmesan, sauce on the side…"
            rows={2}
            className="w-full rounded-2 border border-[1.5px] border-paper-4 bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-8 resize-none focus-visible:outline-none focus-visible:border-saffron focus-visible:border-2 transition-[border-color] duration-standard"
          />
        </div>

        {/* Qty + line total */}
        <div className="flex items-center justify-between py-3.5 border-t border-paper-3">
          <QuantityStepper value={qty} onChange={setQty} />
          <span className="font-mono text-[16px] font-semibold text-ink tabular-nums">
            {formatPriceExact(lineTotalCents, currency)}
          </span>
        </div>

        {/* Add to order */}
        <button
          onClick={handleAdd}
          className="w-full h-12 rounded-[10px] bg-saffron text-paper text-[15px] font-semibold flex items-center justify-between px-5 transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press"
        >
          <span>Add {qty} to order</span>
          <span className="font-mono">{formatPriceExact(lineTotalCents, currency)}</span>
        </button>
      </div>
    </div>
  )
}
