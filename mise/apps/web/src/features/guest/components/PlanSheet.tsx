import { useState, useEffect, useCallback } from 'react'
import type { RestaurantPlan } from '../hooks/usePlans'
import type { MenuItem } from '@mise/types'
import { formatPrice } from '../utils/formatPrice'
import { DietTag } from './DietTag'

interface PlanIncludedItem {
  label: string
  menuItem?: MenuItem
}

interface PlanSheetProps {
  plan: RestaurantPlan
  currency: string
  includedItems: PlanIncludedItem[]
  onClose: () => void
  onAddPlan: (plan: RestaurantPlan) => void
}

export function PlanSheet({ plan, currency, includedItems, onClose, onAddPlan }: PlanSheetProps) {
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

  function handleAdd() {
    onAddPlan(plan)
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
        aria-label={plan.title}
      >
        <div className="w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3.5" />

        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <h2 className="font-display text-[24px] font-[500] tracking-[-0.01em] text-ink leading-tight font-optical">
            {plan.title}
          </h2>
          <span className="font-mono text-[18px] font-semibold text-ink tabular-nums shrink-0">
            {formatPrice(plan.price_cents, currency)}
            <span className="text-[12px] text-ink-6 font-normal ml-1">/ pp</span>
          </span>
        </div>

        {plan.description && (
          <p className="text-[14px] text-ink-5 leading-[1.5] mb-3">{plan.description}</p>
        )}

        {includedItems.length > 0 && (
          <div className="border-t border-paper-3 pt-3 mt-2 space-y-3">
            <h4 className="text-[14px] font-semibold text-ink mb-1.5">What&apos;s included</h4>
            {includedItems.map((entry, i) => {
              const item = entry.menuItem
              if (!item) {
                return (
                  <div key={i} className="flex items-start gap-2 text-[13px] text-ink-7">
                    <span className="text-saffron mt-px leading-none">·</span>
                    <span>{entry.label}</span>
                  </div>
                )
              }
              return (
                <div key={i} className="border border-paper-3 rounded-2 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <h3 className="text-[14px] font-semibold text-ink leading-snug">
                      {item.name}
                    </h3>
                  </div>
                  {item.description && (
                    <p className="text-[13px] text-ink-5 leading-snug mt-0.5">
                      {item.description}
                    </p>
                  )}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {item.tags.map(tag => (
                        <DietTag key={tag} tag={tag} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={handleAdd}
          className="mt-4 w-full h-12 rounded-[10px] bg-saffron text-paper text-[15px] font-semibold flex items-center justify-center px-5 transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press"
        >
          Add plan to order
        </button>
      </div>
    </div>
  )
}

