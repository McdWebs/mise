import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAdminPlans, type AdminPlan } from '../hooks/useAdminPlans'
import { useAdminMenu, type AdminMenuCategory, type AdminMenuItem } from '../hooks/useAdminMenu'
import { Sk } from '../components/Skeleton'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

interface PlansPageProps {
  restaurant: AdminRestaurant
}

interface Draft {
  title: string
  description: string
  price: string
  includedItemIds: string[]
  /** Saved lines that did not match a current menu item (legacy or renamed items) */
  unmatchedLabels: string[]
  active: boolean
  startTime: string  // "HH:MM" or ""
  endTime: string
}

function emptyDraft(): Draft {
  return {
    title: '',
    description: '',
    price: '',
    includedItemIds: [],
    unmatchedLabels: [],
    active: true,
    startTime: '',
    endTime: '',
  }
}

function flattenMenuItems(categories: AdminMenuCategory[]): AdminMenuItem[] {
  return categories.flatMap(c => c.menu_items)
}

/** Map saved include lines to menu item ids where names match; leftover strings stay unmatched. */
function resolveIncludesFromPlan(
  includes: string[],
  categories: AdminMenuCategory[]
): Pick<Draft, 'includedItemIds' | 'unmatchedLabels'> {
  const flat = flattenMenuItems(categories)
  const ids: string[] = []
  const unmatched: string[] = []
  for (const line of includes) {
    const found = flat.find(i => i.name === line && !ids.includes(i.id))
    if (found) ids.push(found.id)
    else unmatched.push(line)
  }
  return { includedItemIds: ids, unmatchedLabels: unmatched }
}

function buildIncludesPayload(
  draft: Draft,
  categories: AdminMenuCategory[]
): string[] {
  const flat = flattenMenuItems(categories)
  const byId = new Map(flat.map(i => [i.id, i]))
  const fromMenu = draft.includedItemIds
    .map(id => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n))
  return [...fromMenu, ...draft.unmatchedLabels]
}

function PlanFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-label text-ink-6 font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const planFormInputCls =
  'w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper placeholder:text-ink-7 focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard'

function PlanIncludesPicker({
  categories,
  menuLoading,
  includedItemIds,
  unmatchedLabels,
  setIncludedItemIds,
  setUnmatchedLabels,
}: {
  categories: AdminMenuCategory[]
  menuLoading: boolean
  includedItemIds: string[]
  unmatchedLabels: string[]
  setIncludedItemIds: (ids: string[] | ((prev: string[]) => string[])) => void
  setUnmatchedLabels: (labels: string[] | ((prev: string[]) => string[])) => void
}) {
  const flat = flattenMenuItems(categories)
  const byId = new Map(flat.map(i => [i.id, i]))
  const selectedSet = new Set(includedItemIds)

  function addItem(id: string) {
    if (selectedSet.has(id)) return
    setIncludedItemIds(prev => [...prev, id])
  }

  function removeItem(id: string) {
    setIncludedItemIds(prev => prev.filter(x => x !== id))
  }

  function moveItem(index: number, delta: number) {
    const to = index + delta
    if (to < 0 || to >= includedItemIds.length) return
    setIncludedItemIds(prev => {
      const next = prev.slice()
      const [row] = next.splice(index, 1)
      next.splice(to, 0, row)
      return next
    })
  }

  function removeUnmatched(index: number) {
    setUnmatchedLabels(prev => prev.filter((_, i) => i !== index))
  }

  if (menuLoading && flat.length === 0) {
    return (
      <p className="text-body-sm text-ink-6 py-2">Loading menu…</p>
    )
  }

  if (flat.length === 0) {
    return (
      <p className="text-body-sm text-ink-6 py-2">
        Add categories and items on the Menu page first, then you can attach them to a plan.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {(includedItemIds.length > 0 || unmatchedLabels.length > 0) && (
        <div>
          <p className="text-body-sm text-ink-7 mb-2">Included (guests see this order)</p>
          <ul className="rounded-2 border border-paper-3 divide-y divide-paper-3 bg-paper-2/40">
            {includedItemIds.map((id, index) => {
              const item = byId.get(id)
              const label = item?.name ?? '(removed from menu)'
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 px-3 py-2.5 text-body text-ink"
                >
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="px-2 py-1 rounded-1 text-body-sm text-ink-6 hover:bg-paper-2 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === includedItemIds.length - 1}
                      className="px-2 py-1 rounded-1 text-body-sm text-ink-6 hover:bg-paper-2 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(id)}
                      className="px-2 py-1 rounded-1 text-body-sm text-ember hover:bg-ember-wash"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
            {unmatchedLabels.map((label, i) => (
              <li
                key={`u-${i}-${label}`}
                className="flex items-center gap-2 px-3 py-2.5 text-body text-ink-6"
              >
                <span className="flex-1 min-w-0 truncate" title="Not linked to a current menu item">
                  {label}
                  <span className="text-[11px] ml-1.5 text-ink-7">(custom)</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeUnmatched(i)}
                  className="text-body-sm text-ember hover:bg-ember-wash px-2 py-1 rounded-1 shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-body-sm text-ink-7 mb-2">Add from menu</p>
        <div className="max-h-[280px] overflow-y-auto rounded-2 border border-paper-3 divide-y divide-paper-3">
          {categories.map(cat => (
            <div key={cat.id}>
              <div className="px-3 py-2 bg-paper-2 text-overline text-ink-6 uppercase tracking-widest text-[10px]">
                {cat.name}
              </div>
              <ul className="px-2 pb-2">
                {cat.menu_items.map(item => {
                  const on = selectedSet.has(item.id)
                  return (
                    <li key={item.id} className="flex items-center gap-2 py-1.5 px-1">
                      <button
                        type="button"
                        onClick={() => (on ? removeItem(item.id) : addItem(item.id))}
                        className={`flex-1 text-left px-2 py-2 rounded-2 text-body-sm transition-colors duration-hover ${
                          on
                            ? 'bg-ink text-paper'
                            : 'text-ink hover:bg-paper-2'
                        }`}
                      >
                        <span className="font-medium">{item.name}</span>
                        {!item.available && (
                          <span className="text-ink-7 font-normal ml-1.5">· unavailable</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PlansPage({ restaurant }: PlansPageProps) {
  const qc = useQueryClient()
  const { data: plans = [], isLoading } = useAdminPlans(restaurant.id)

  // undefined = closed, null = new, AdminPlan = editing existing
  const [editing, setEditing] = useState<AdminPlan | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const includesHydratedRef = useRef<string | null>(null)

  const formOpen = editing !== undefined
  const editingPlanId = typeof editing === 'object' && editing ? editing.id : null

  const { data: menuCategories = [], isLoading: menuLoading } = useAdminMenu(
    formOpen ? restaurant.id : undefined
  )

  useEffect(() => {
    if (editing === undefined) {
      includesHydratedRef.current = null
      return
    }
    if (editing === null) {
      includesHydratedRef.current = null
      return
    }
    if (!menuCategories.length) return
    if (includesHydratedRef.current === editing.id) return
    includesHydratedRef.current = editing.id
    setDraft(d => ({
      ...d,
      ...resolveIncludesFromPlan(editing.includes, menuCategories),
    }))
  }, [editing, editingPlanId, menuCategories])

  function openNew() {
    includesHydratedRef.current = null
    setEditing(null)
    setDraft(emptyDraft())
  }

  function openEdit(plan: AdminPlan) {
    includesHydratedRef.current = null
    setEditing(plan)
    setDraft({
      title: plan.title,
      description: plan.description ?? '',
      price: (plan.price_cents / 100).toFixed(2),
      active: plan.active,
      startTime: plan.start_time ?? '',
      endTime: plan.end_time ?? '',
      ...resolveIncludesFromPlan(plan.includes, []),
    })
  }

  function closeForm() {
    includesHydratedRef.current = null
    setEditing(undefined)
  }

  async function save() {
    if (!draft.title.trim()) return
    setSaving(true)
    const includes = buildIncludesPayload(draft, menuCategories)
    const payload = {
      restaurant_id: restaurant.id,
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      price_cents: Math.round(Number(draft.price) * 100),
      includes,
      active: draft.active,
      start_time: draft.startTime || null,
      end_time: draft.endTime || null,
    }
    if (editing) {
      await supabase.from('restaurant_plans').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('restaurant_plans').insert({ ...payload, sort_order: plans.length })
    }
    await qc.invalidateQueries({ queryKey: ['admin-plans', restaurant.id] })
    setSaving(false)
    closeForm()
  }

  async function toggleActive(plan: AdminPlan) {
    await supabase.from('restaurant_plans').update({ active: !plan.active }).eq('id', plan.id)
    await qc.invalidateQueries({ queryKey: ['admin-plans', restaurant.id] })
  }

  async function deletePlan(plan: AdminPlan) {
    if (!window.confirm(`Delete "${plan.title}"?`)) return
    await supabase.from('restaurant_plans').delete().eq('id', plan.id)
    await qc.invalidateQueries({ queryKey: ['admin-plans', restaurant.id] })
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Plans
          </h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            Fixed deals shown to guests at the top of your menu.
          </div>
        </div>
        {editing === undefined && (
          <button
            onClick={openNew}
            className="px-4 py-2.5 rounded-2 bg-saffron text-paper text-body font-semibold hover:bg-saffron-2 transition-colors duration-hover active:scale-[0.98] active:duration-press"
          >
            + New plan
          </button>
        )}
      </div>

      {/* Create / edit form */}
      {editing !== undefined && (
        <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-5">
          <h2 className="font-display text-[20px] font-[500] text-ink font-optical mb-4">
            {editing ? 'Edit plan' : 'New plan'}
          </h2>
          <div className="space-y-4 max-w-[600px]">
            <PlanFormField label="Title">
              <input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Business lunch"
                className={planFormInputCls}
              />
            </PlanFormField>

            <PlanFormField label="Description (optional)">
              <textarea
                value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="A short line about the deal."
                rows={2}
                className={`${planFormInputCls} resize-none`}
              />
            </PlanFormField>

            <PlanFormField label="Price per person">
              <div className="flex items-center gap-2 w-44 px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 focus-within:border-saffron transition-[border-color] duration-standard">
                <span className="text-ink-5 text-body">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.price}
                  onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                  placeholder="0.00"
                  className="flex-1 bg-transparent outline-none text-body text-ink placeholder:text-ink-7 w-0"
                />
              </div>
            </PlanFormField>

            <PlanFormField label="Available hours">
              <p className="text-body-sm text-ink-7 mb-1.5">Leave blank to show all day.</p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))}
                  className="px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
                />
                <span className="text-ink-6 text-body-sm">to</span>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))}
                  className="px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
                />
                {(draft.startTime || draft.endTime) && (
                  <button
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, startTime: '', endTime: '' }))}
                    className="text-body-sm text-ink-6 hover:text-ink transition-colors duration-hover"
                  >
                    Clear
                  </button>
                )}
              </div>
            </PlanFormField>

            <PlanFormField label="What's included">
              <p className="text-body-sm text-ink-7 mb-1.5">
                Choose dishes from your menu. Guests still see them as a simple list.
              </p>
              <PlanIncludesPicker
                categories={menuCategories}
                menuLoading={menuLoading}
                includedItemIds={draft.includedItemIds}
                unmatchedLabels={draft.unmatchedLabels}
                setIncludedItemIds={up => setDraft(d => ({ ...d, includedItemIds: typeof up === 'function' ? up(d.includedItemIds) : up }))}
                setUnmatchedLabels={up => setDraft(d => ({ ...d, unmatchedLabels: typeof up === 'function' ? up(d.unmatchedLabels) : up }))}
              />
            </PlanFormField>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
                className="w-4 h-4 accent-saffron"
              />
              <span className="text-body text-ink">Visible to guests</span>
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving || !draft.title.trim()}
                className="px-4 py-2.5 rounded-2 bg-saffron text-paper text-body font-semibold hover:bg-saffron-2 transition-colors duration-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save plan'}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-2.5 rounded-2 border-[1.5px] border-paper-4 text-ink text-body hover:bg-paper-2 transition-colors duration-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plans list */}
      {isLoading ? (
        <div className="bg-paper border border-paper-3 rounded-3 divide-y divide-paper-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-1.5">
                <Sk className="h-5 w-40" />
                <Sk className="h-3 w-64" />
              </div>
              <Sk className="h-4 w-12" />
              <Sk className="h-6 w-14 rounded-pill" />
              <Sk className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 && editing === undefined ? (
        <div className="bg-paper border border-paper-3 rounded-3 p-10 text-center">
          <p className="text-body font-medium text-ink-5">No plans yet.</p>
          <p className="text-body-sm text-ink-7 mt-1">
            Create a plan to show guests a fixed-price deal at the top of your menu.
          </p>
        </div>
      ) : plans.length > 0 ? (
        <div className="bg-paper border border-paper-3 rounded-3 overflow-hidden">
          {plans.map(plan => (
            <div
              key={plan.id}
              className="grid items-center gap-5 px-5 py-4 border-b border-paper-3 last:border-b-0"
              style={{ gridTemplateColumns: '1fr auto auto auto' }}
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">{plan.title}</p>
                {plan.description && (
                  <p className="text-body-sm text-ink-6 mt-0.5 truncate">{plan.description}</p>
                )}
                <p className="text-[11px] text-ink-7 mt-1 font-mono">
                  {plan.start_time && plan.end_time
                    ? `${plan.start_time} – ${plan.end_time}`
                    : plan.start_time
                    ? `from ${plan.start_time}`
                    : plan.end_time
                    ? `until ${plan.end_time}`
                    : 'All day'}
                </p>
              </div>

              <span className="font-mono text-body font-semibold text-ink tabular-nums">
                ${(plan.price_cents / 100).toFixed(2)}
              </span>

              <button
                onClick={() => toggleActive(plan)}
                className={`px-3 py-1 rounded-pill text-body-sm font-medium border-[1.5px] transition-colors duration-hover ${
                  plan.active
                    ? 'bg-herb-wash text-herb-2 border-herb/30 hover:bg-herb/20'
                    : 'bg-paper text-ink-6 border-paper-4 hover:border-ink-5'
                }`}
              >
                {plan.active ? 'Live' : 'Off'}
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => openEdit(plan)}
                  className="px-2.5 py-1.5 text-body-sm text-ink-5 hover:text-ink hover:bg-paper-2 rounded-2 transition-colors duration-hover"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePlan(plan)}
                  className="px-2.5 py-1.5 text-body-sm text-ember hover:bg-ember/10 rounded-2 transition-colors duration-hover"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}
