import { ShoppingCart } from 'lucide-react'
import { formatPriceExact } from '../utils/formatPrice'

interface CartBarProps {
  itemCount: number
  totalCents: number
  currency: string
  onOpen: () => void
}

export function CartBar({ itemCount, totalCents, currency, onOpen }: CartBarProps) {
  if (itemCount === 0) return null

  return (
    <div className="sticky bottom-0 px-4 pb-4 pt-2 z-[6] pointer-events-none">
      <button
        onClick={onOpen}
        className="w-full pointer-events-auto bg-ink text-paper rounded-[12px] px-[18px] py-3.5 flex items-center justify-between shadow-1 transition-colors duration-hover hover:bg-ink-2 active:scale-[0.98] active:duration-press"
        aria-label={`View your order — ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="bg-saffron text-paper rounded-pill font-mono text-[12px] font-bold px-2.5 py-0.5 tabular-nums">
            {itemCount}
          </span>
          <span className="text-[14px] font-semibold flex items-center gap-1.5">
            <ShoppingCart size={16} className="opacity-70" />
            Your order
          </span>
        </div>
        <span className="font-mono text-[15px] font-semibold tabular-nums">
          {formatPriceExact(totalCents, currency)}
        </span>
      </button>
    </div>
  )
}
