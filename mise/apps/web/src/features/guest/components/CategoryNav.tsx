import { forwardRef, useRef, type MutableRefObject } from 'react'
import { cn } from '@mise/ui'
import type { MenuCategory } from '@mise/types'

const TABLECLOTH_BG = {
  backgroundImage: 'url(/assets/pattern-tablecloth.svg)',
  backgroundRepeat: 'repeat' as const,
}

interface CategoryNavProps {
  categories: MenuCategory[]
  activeId: string | null
  onPick: (id: string) => void
}

export const CategoryNav = forwardRef<HTMLDivElement, CategoryNavProps>(
  function CategoryNav({ categories, activeId, onPick }, forwardedRef) {
    const ref = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>

    const setRootRef = (el: HTMLDivElement | null) => {
      ref.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = el
    }

    const handlePick = (id: string) => {
      onPick(id)
      // Scroll selected chip into view
      const chip = ref.current?.querySelector(`[data-cat="${id}"]`)
      chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }

    return (
      <div
        ref={setRootRef}
        className="sticky top-0 z-[5] flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-paper-3 bg-paper scrollbar-none"
        style={{ ...TABLECLOTH_BG, WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map(cat => (
          <button
            key={cat.id}
            data-cat={cat.id}
            onClick={() => handlePick(cat.id)}
            className={cn(
              'flex-shrink-0 px-[13px] py-[7px] rounded-pill border border-[1.5px] text-[13px] font-medium transition-all duration-hover cursor-pointer whitespace-nowrap',
              activeId === cat.id
                ? 'bg-ink text-paper border-ink'
                : 'bg-transparent text-ink border-paper-4 hover:border-paper-3 hover:bg-paper/55'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    )
  }
)
