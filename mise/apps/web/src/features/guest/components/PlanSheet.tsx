import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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
  onAddPlan: (plan: RestaurantPlan, detailLines: string[]) => void
}

interface ModOption {
  id: string
  name: string
  price_cents: number
  sort_order: number
}

interface ModGroup {
  id: string
  menu_item_id: string
  name: string
  required: boolean
  max_selections: number | null
  sort_order: number
  modifier_options: ModOption[]
}

const noteCls =
  'w-full mt-2.5 px-2.5 py-1.5 rounded-[8px] text-[13px] text-ink bg-paper-2 border border-paper-3 placeholder:text-ink-7 focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard resize-none'

function ModGroupPicker({
  group,
  selected,
  onToggle,
  currency,
}: {
  group: ModGroup
  selected: Set<string>
  onToggle: (optionId: string) => void
  currency: string
}) {
  const isSingle = group.max_selections === 1
  return (
    <div className="mt-3 pt-3 border-t border-paper-3">
      <div className="flex items-baseline gap-2 mb-2">
        <h4 className="text-[13px] font-semibold text-ink">{group.name}</h4>
        <span className="text-[11px] text-ink-6">
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
              onClick={() => onToggle(opt.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-2 border-[1.5px] text-left transition-colors duration-hover ${
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
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px]">{opt.name}</span>
              </div>
              {opt.price_cents > 0 && (
                <span className="text-[12px] text-ink-6 font-mono tabular-nums shrink-0">
                  +{formatPrice(opt.price_cents, currency)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PlanSheet({ plan, currency, includedItems, onClose, onAddPlan }: PlanSheetProps) {
  const [open, setOpen]           = useState(false)
  const [notes, setNotes]         = useState<Record<number, string>>({})
  const [planNote, setPlanNote]   = useState('')
  // modifier groups keyed by menu_item_id
  const [modGroups, setModGroups] = useState<Record<string, ModGroup[]>>({})
  const [loadingMods, setLoadingMods] = useState(false)
  // selections: itemId → groupId → Set<optionId>
  const [selections, setSelections] = useState<Record<string, Record<string, Set<string>>>>({})

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Fetch modifier groups for all linked menu items in one query
  useEffect(() => {
    const ids = includedItems.map(e => e.menuItem?.id).filter(Boolean) as string[]
    if (ids.length === 0) return
    setLoadingMods(true)
    void (async () => {
      const { data } = await supabase
        .from('modifier_groups')
        .select('id, menu_item_id, name, required, max_selections, sort_order, modifier_options(id, name, price_cents, sort_order)')
        .in('menu_item_id', ids)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'modifier_options' })
      const grouped: Record<string, ModGroup[]> = {}
      for (const g of ((data ?? []) as unknown as ModGroup[])) {
        ;(grouped[g.menu_item_id] ??= []).push(g)
      }
      setModGroups(grouped)
      setLoadingMods(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  function toggleOption(itemId: string, groupId: string, optionId: string, isSingle: boolean) {
    setSelections(prev => {
      const itemSel = { ...(prev[itemId] ?? {}) }
      const current = new Set(itemSel[groupId] ?? [])
      if (current.has(optionId)) {
        current.delete(optionId)
      } else {
        if (isSingle) current.clear()
        current.add(optionId)
      }
      itemSel[groupId] = current
      return { ...prev, [itemId]: itemSel }
    })
  }

  // Required groups that have no selection yet (across all items)
  const unsatisfiedRequired = includedItems.flatMap(entry => {
    if (!entry.menuItem) return []
    return (modGroups[entry.menuItem.id] ?? []).filter(g => {
      return g.required && !(selections[entry.menuItem!.id]?.[g.id]?.size)
    })
  })
  const canAdd = !loadingMods && unsatisfiedRequired.length === 0

  function handleAdd() {
    const customDetailLines = includedItems.map((entry, i) => {
      const parts: string[] = [entry.label]
      if (entry.menuItem) {
        const groups = modGroups[entry.menuItem.id] ?? []
        for (const g of groups) {
          const sel = selections[entry.menuItem.id]?.[g.id]
          if (sel?.size) {
            parts.push(...g.modifier_options.filter(o => sel.has(o.id)).map(o => o.name))
          }
        }
      }
      const note = notes[i]?.trim()
      if (note) parts.push(note)
      return parts.join(' · ')
    })
    if (planNote.trim()) customDetailLines.push(`Note: ${planNote.trim()}`)
    onAddPlan(plan, customDetailLines)
    onClose()
  }

  const hasItems = includedItems.length > 0

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

        {/* Header */}
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

        {/* Included items with modifier groups + per-item note */}
        {hasItems && (
          <div className="border-t border-paper-3 pt-3 mt-2 space-y-3">
            <h4 className="text-[14px] font-semibold text-ink mb-1.5">What&apos;s included</h4>

            {includedItems.map((entry, i) => {
              const item = entry.menuItem
              const groups = item ? (modGroups[item.id] ?? []) : []
              const isItemLoading = loadingMods && item != null

              return (
                <div key={i} className="border border-paper-3 rounded-2 px-3 py-2.5">
                  {/* Item header */}
                  {item ? (
                    <>
                      <h3 className="text-[14px] font-semibold text-ink leading-snug">{item.name}</h3>
                      {item.description && (
                        <p className="text-[13px] text-ink-5 leading-snug mt-0.5">{item.description}</p>
                      )}
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.tags.map(tag => <DietTag key={tag} tag={tag} />)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-start gap-2 text-[13px] text-ink-7">
                      <span className="text-saffron mt-px leading-none shrink-0">·</span>
                      <span>{entry.label}</span>
                    </div>
                  )}

                  {/* Modifier groups loading skeleton */}
                  {isItemLoading && (
                    <div className="mt-3 pt-3 border-t border-paper-3 space-y-1.5" aria-busy="true">
                      <div className="h-3 w-24 rounded bg-paper-3 animate-pulse" />
                      <div className="h-9 rounded-2 bg-paper-3 animate-pulse" />
                      <div className="h-9 rounded-2 bg-paper-3 animate-pulse" />
                    </div>
                  )}

                  {/* Modifier groups */}
                  {!isItemLoading && item && groups.map(group => (
                    <ModGroupPicker
                      key={group.id}
                      group={group}
                      selected={selections[item.id]?.[group.id] ?? new Set()}
                      onToggle={(optionId) =>
                        toggleOption(item.id, group.id, optionId, group.max_selections === 1)
                      }
                      currency={currency}
                    />
                  ))}

                  {/* Per-item note */}
                  <textarea
                    rows={1}
                    value={notes[i] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder={item ? 'Any special requests?' : 'Special request…'}
                    className={noteCls}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Overall plan note */}
        <div className={hasItems ? 'mt-4' : 'mt-2'}>
          <label className="block text-[12px] font-semibold text-ink-6 uppercase tracking-[0.06em] mb-1.5">
            Plan note <span className="font-normal normal-case tracking-normal text-ink-7">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={planNote}
            onChange={e => setPlanNote(e.target.value)}
            placeholder="Allergies, dietary requirements, or anything for the kitchen…"
            className={noteCls}
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="mt-4 w-full h-12 rounded-[10px] bg-saffron text-paper text-[15px] font-semibold flex items-center justify-center px-5 transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMods
            ? 'Loading options…'
            : !canAdd
            ? `Choose ${unsatisfiedRequired.map(g => g.name.toLowerCase()).join(', ')}`
            : 'Add plan to order'}
        </button>
      </div>
    </div>
  )
}
