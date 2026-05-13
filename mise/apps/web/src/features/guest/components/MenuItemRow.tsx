import type { MenuItem } from '@mise/types'
import { formatPrice } from '../utils/formatPrice'
import { DietTag } from './DietTag'

interface MenuItemRowProps {
  item: MenuItem
  currency: string
  onOpen: (item: MenuItem) => void
}

export function MenuItemRow({ item, currency, onOpen }: MenuItemRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={e => e.key === 'Enter' && onOpen(item)}
      className="flex gap-3.5 py-3.5 border-b border-paper-3 last:border-0 cursor-pointer active:bg-paper-2 transition-colors duration-hover"
    >
      {/* Typographic placeholder thumbnail — 76×76, square, paper-2 bg */}
      <div className="w-[76px] h-[76px] rounded-2 bg-paper-2 border border-paper-3 flex items-center justify-center shrink-0 overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display italic text-[32px] text-ink-7 leading-none select-none font-optical">
            {item.name.charAt(0).toLowerCase()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <p className="font-display text-[17px] font-[500] tracking-[-0.005em] text-ink leading-snug font-optical">
          {item.name}
        </p>
        <p className="text-[13px] text-ink-5 leading-[1.4] line-clamp-2">
          {item.description}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {item.tags.map(tag => <DietTag key={tag} tag={tag} />)}
          <span className="font-mono text-[14px] font-semibold text-ink tabular-nums ml-auto">
            {formatPrice(item.price_cents, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
