import { useRef } from 'react'
import { cn } from '@servo/ui'
import type { MenuCategory } from '@servo/types'

interface CategoryNavProps {
  categories: MenuCategory[]
  activeId: string | null
  onPick: (id: string) => void
}

export function CategoryNav({ categories, activeId, onPick }: CategoryNavProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handlePick = (id: string) => {
    onPick(id)
    // Scroll selected chip into view
    const chip = ref.current?.querySelector(`[data-cat="${id}"]`)
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div
      ref={ref}
      className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-paper-3 sticky top-[73px] z-[4] scrollbar-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
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
              : 'bg-paper text-ink border-paper-4 hover:border-paper-3'
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
