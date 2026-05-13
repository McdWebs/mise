import { useState, useEffect, useCallback } from 'react'
import type { MenuItem } from '@servo/types'
import { supabase } from '@/lib/supabase'
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

interface ModOption {
  id: string
  name: string
  price_cents: number
  sort_order: number
}

interface ModGroup {
  id: string
  name: string
  required: boolean
  max_selections: number | null
  sort_order: number
  modifier_options: ModOption[]
}

export function ItemSheet({ item, currency, onClose, onAdd }: ItemSheetProps) {
  const [qty, setQty] = useState(1)
  const [request, setRequest] = useState('')
  const [open, setOpen] = useState(false)
  const [modGroups, setModGroups] = useState<ModGroup[]>([])
  const [modGroupsLoading, setModGroupsLoading] = useState(true)
  const [selections, setSelections] = useState<Record<string, Set<string>>>({})

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

  // Fetch modifier groups for this item
  useEffect(() => {
    let cancelled = false
    setModGroupsLoading(true)
    setModGroups([])
    setSelections({})
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('modifier_groups')
          .select('id, name, required, max_selections, sort_order, modifier_options(id, name, price_cents, sort_order)')
          .eq('menu_item_id', item.id)
          .order('sort_order')
          .order('sort_order', { referencedTable: 'modifier_options' })
        if (cancelled) return
        setModGroups(error ? [] : ((data as unknown as ModGroup[]) ?? []))
        setSelections({})
      } finally {
        if (!cancelled) setModGroupsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [item.id])

  function toggleOption(groupId: string, optionId: string, isSingle: boolean) {
    setSelections(prev => {
      const current = new Set(prev[groupId] ?? [])
      if (current.has(optionId)) {
        current.delete(optionId)
      } else {
        if (isSingle) current.clear()
        current.add(optionId)
      }
      return { ...prev, [groupId]: current }
    })
  }

  const extraCents = modGroups.reduce((sum, g) =>
    sum + g.modifier_options
      .filter(o => selections[g.id]?.has(o.id))
      .reduce((s, o) => s + o.price_cents, 0),
    0
  )
  const unitPriceCents = item.price_cents + extraCents
  const lineTotalCents = unitPriceCents * qty

  const unsatisfiedRequired = modGroups.filter(g => g.required && !(selections[g.id]?.size))
  const canAdd = !modGroupsLoading && unsatisfiedRequired.length === 0

  function handleAdd() {
    const selectedNames = modGroups.flatMap(g =>
      g.modifier_options.filter(o => selections[g.id]?.has(o.id)).map(o => o.name)
    )
    const modifiers = [
      ...selectedNames,
      ...(request.trim() ? [request.trim()] : []),
    ]
    onAdd({
      kind: 'menu',
      menuItemId: item.id,
      name: item.name,
      unitPriceCents,
      quantity: qty,
      modifiers,
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

        {/* Name + base price */}
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

        {/* Allergens */}
        {(item.allergens?.length ?? 0) > 0 && (
          <p className="text-[12px] text-ember mb-3">
            Contains: {item.allergens.join(', ')}
          </p>
        )}

        {/* Modifier groups */}
        {modGroupsLoading && (
          <div className="border-t border-paper-3 pt-3 mb-1" aria-busy="true" aria-label="Loading options">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-3.5 w-20 rounded bg-paper-3 animate-pulse" />
              <div className="h-2.5 w-14 rounded bg-paper-3 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-9 rounded-2 bg-paper-3 animate-pulse" />
              <div className="h-9 rounded-2 bg-paper-3 animate-pulse" />
            </div>
          </div>
        )}
        {!modGroupsLoading && modGroups.length > 0 && (
          <div className="space-y-4 border-t border-paper-3 pt-3.5 mb-1">
            {modGroups.map(group => {
              const isSingle = group.max_selections === 1
              const selected = selections[group.id] ?? new Set<string>()
              return (
                <div key={group.id}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h4 className="text-[14px] font-semibold text-ink">{group.name}</h4>
                    <span className="text-[12px] text-ink-6">
                      {group.required ? 'Required' : 'Optional'}
                      {isSingle ? ' · pick one' : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.modifier_options.map(opt => {
                      const isSelected = selected.has(opt.id)
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleOption(group.id, opt.id, isSingle)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2 border-[1.5px] text-left transition-colors duration-hover ${
                            isSelected
                              ? 'bg-saffron/10 border-saffron text-ink'
                              : 'bg-paper border-paper-3 text-ink hover:border-paper-4'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                                isSingle ? 'rounded-full border-[1.5px]' : 'rounded border-[1.5px]'
                              } ${isSelected ? 'bg-saffron border-saffron' : 'border-paper-4 bg-paper'}`}
                            >
                              {isSelected && isSingle && (
                                <span className="w-1.5 h-1.5 rounded-full bg-paper" />
                              )}
                              {isSelected && !isSingle && (
                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            <span className="text-[14px]">{opt.name}</span>
                          </div>
                          {opt.price_cents > 0 && (
                            <span className="text-[13px] text-ink-6 font-mono tabular-nums shrink-0">
                              +{formatPrice(opt.price_cents, currency)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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

        {/* Qty + running total */}
        <div className="flex items-center justify-between py-3.5 border-t border-paper-3">
          <QuantityStepper value={qty} onChange={setQty} />
          <span className="font-mono text-[16px] font-semibold text-ink tabular-nums">
            {formatPriceExact(lineTotalCents, currency)}
          </span>
        </div>

        {/* Add to order */}
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full h-12 rounded-[10px] bg-saffron text-paper text-[15px] font-semibold flex items-center justify-between px-5 transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>
            {modGroupsLoading
              ? 'Loading options…'
              : canAdd
                ? `Add ${qty} to order`
                : `Choose ${unsatisfiedRequired.map(g => g.name.toLowerCase()).join(', ')}`}
          </span>
          <span className="font-mono">{formatPriceExact(lineTotalCents, currency)}</span>
        </button>
      </div>
    </div>
  )
}
