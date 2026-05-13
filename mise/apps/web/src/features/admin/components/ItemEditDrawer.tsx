import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { currencySymbol } from '@/features/guest/utils/formatPrice'
import type { AdminMenuItem } from '../hooks/useAdminMenu'

const PRESET_TAGS = ['Vegetarian', 'Gluten-free', 'Spicy'] as const

const ALLERGENS = [
  'Gluten', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Peanuts',
  'Tree nuts', 'Soy', 'Sesame', 'Mustard', 'Celery', 'Sulphites',
  'Lupin', 'Molluscs',
] as const

interface ItemEditDrawerProps {
  open: boolean
  categoryId: string
  categoryName: string
  currency: string
  item?: AdminMenuItem | null
  onClose: () => void
}

interface ModOption {
  id: string
  name: string
  price_cents: number
}

interface ModGroup {
  id: string
  name: string
  required: boolean
  max_selections: number | null
  options: ModOption[]
}

export function ItemEditDrawer({ open, categoryId, categoryName, currency, item, onClose }: ItemEditDrawerProps) {
  const qc = useQueryClient()
  const isNew = !item

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [allergens, setAllergens] = useState<string[]>([])
  const [customAllergenInput, setCustomAllergenInput] = useState('')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modifier state
  const [groups, setGroups] = useState<ModGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [newOptionText, setNewOptionText] = useState<Record<string, string>>({})

  // Sync item fields when item/open changes
  useEffect(() => {
    if (item) {
      setName(item.name)
      setDesc(item.description ?? '')
      setPrice((item.price_cents / 100).toFixed(2))
      setTags(item.tags ?? [])
      setAllergens(item.allergens ?? [])
      setAvailable(item.available)
    } else {
      setName(''); setDesc(''); setPrice(''); setTags([]); setAllergens([]); setAvailable(true)
    }
    setCustomTagInput('')
    setCustomAllergenInput('')
  }, [item, open])

  // Fetch modifier groups when editing an existing item
  useEffect(() => {
    if (!item || !open) { setGroups([]); return }
    setGroupsLoading(true)
    supabase
      .from('modifier_groups')
      .select('id, name, required, max_selections, sort_order, modifier_options(id, name, price_cents, sort_order)')
      .eq('menu_item_id', item.id)
      .order('sort_order')
      .order('sort_order', { referencedTable: 'modifier_options' })
      .then(({ data }) => {
        type RawG = { id: string; name: string; required: boolean; max_selections: number | null; modifier_options: ModOption[] }
        setGroups(((data ?? []) as unknown as RawG[]).map(g => ({
          id: g.id,
          name: g.name,
          required: g.required,
          max_selections: g.max_selections,
          options: (g.modifier_options ?? []).map(o => ({ id: o.id, name: o.name, price_cents: o.price_cents })),
        })))
        setGroupsLoading(false)
      })
  }, [item?.id, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const canSave = name.trim() !== '' && price.trim() !== '' && !isNaN(Number(price))

  async function save() {
    if (!canSave) return
    setSaving(true)
    const price_cents = Math.round(Number(price) * 100)
    if (isNew) {
      await supabase.from('menu_items').insert({
        category_id: categoryId,
        name: name.trim(),
        description: desc.trim() || null,
        price_cents,
        available,
        tags,
        allergens,
        sort_order: 9999,
      })
    } else {
      await supabase.from('menu_items').update({
        name: name.trim(),
        description: desc.trim() || null,
        price_cents,
        available,
        tags,
        allergens,
      }).eq('id', item!.id)
    }
    await qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setSaving(false)
    onClose()
  }

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function addCustomTag() {
    const t = customTagInput.trim()
    if (!t || tags.includes(t)) return
    setTags(prev => [...prev, t])
    setCustomTagInput('')
  }

  function toggleAllergen(a: string) {
    setAllergens(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function addCustomAllergen() {
    const a = customAllergenInput.trim()
    if (!a || allergens.includes(a)) return
    setAllergens(prev => [...prev, a])
    setCustomAllergenInput('')
  }

  // ── Modifier operations (immediate-save, fire-and-forget per field) ────────

  async function addGroup() {
    if (!item) return
    const { data } = await supabase
      .from('modifier_groups')
      .insert({ menu_item_id: item.id, name: 'New group', sort_order: groups.length, required: false, max_selections: null })
      .select('id, name, required, max_selections')
      .single()
    if (data) setGroups(prev => [...prev, { id: data.id, name: data.name, required: data.required, max_selections: data.max_selections, options: [] }])
  }

  async function updateGroup(id: string, patch: Partial<{ name: string; required: boolean; max_selections: number | null }>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g))
    await supabase.from('modifier_groups').update(patch).eq('id', id)
  }

  async function deleteGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id))
    await supabase.from('modifier_groups').delete().eq('id', id)
  }

  async function addOption(groupId: string) {
    const optName = (newOptionText[groupId] ?? '').trim()
    if (!optName) return
    const group = groups.find(g => g.id === groupId)
    const { data } = await supabase
      .from('modifier_options')
      .insert({ group_id: groupId, name: optName, price_cents: 0, sort_order: group?.options.length ?? 0 })
      .select('id, name, price_cents')
      .single()
    if (data) {
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, options: [...g.options, { id: data.id, name: data.name, price_cents: data.price_cents }] }
        : g
      ))
      setNewOptionText(prev => ({ ...prev, [groupId]: '' }))
    }
  }

  async function deleteOption(groupId: string, optionId: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g))
    await supabase.from('modifier_options').delete().eq('id', optionId)
  }

  function patchOptionLocal(groupId: string, optionId: string, patch: Partial<ModOption>) {
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, options: g.options.map(o => o.id === optionId ? { ...o, ...patch } : o) }
      : g
    ))
  }

  async function saveOptionName(groupId: string, optionId: string, name: string) {
    await supabase.from('modifier_options').update({ name }).eq('id', optionId)
  }

  async function saveOptionPrice(groupId: string, optionId: string, price_cents: number) {
    await supabase.from('modifier_options').update({ price_cents }).eq('id', optionId)
  }

  function patchGroupLocal(id: string, patch: Partial<ModGroup>) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g))
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 bg-paper flex flex-col shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between px-7 pt-7 pb-1.5 shrink-0">
          <h2 className="font-display text-[26px] font-[500] text-ink leading-none tracking-[-0.01em] font-optical">
            {isNew ? 'New item' : 'Edit item'}
          </h2>
          <button onClick={onClose} className="text-ink-6 hover:text-ink text-[22px] leading-none">
            <X size={20} />
          </button>
        </div>
        <p className="px-7 text-body-sm text-ink-6 mb-5 shrink-0">
          {isNew ? 'Adding to' : 'In'} <strong className="text-ink font-semibold">{categoryName}</strong>
        </p>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-7 space-y-4">
          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Roasted heirloom carrots"
              className="w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
            />
          </div>

          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="One line. Guests and the assistant read this."
              rows={2}
              className="w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard resize-y"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="shrink-0">
              <label className="block text-overline text-ink-6 uppercase tracking-widest mb-1.5">Price</label>
              <div className="flex items-center border-[1.5px] border-paper-4 rounded-2 px-3 w-[180px] max-w-full focus-within:border-saffron transition-[border-color] duration-standard">
                <span className="font-mono text-ink-6 mr-1">{currencySymbol(currency)}</span>
                <input
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="flex-1 py-2.5 font-mono text-body text-ink bg-transparent focus-visible:outline-none min-w-0"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-1 min-w-[min(100%,220px)] max-w-full sm:max-w-[260px] p-3 bg-paper-2 rounded-3">
              <p className="text-body font-semibold text-ink leading-tight min-w-0">Available to order</p>
              <button
                type="button"
                role="switch"
                aria-checked={available}
                onClick={() => setAvailable(v => !v)}
                className={`shrink-0 w-8 h-[18px] rounded-pill relative transition-colors duration-hover ${available ? 'bg-herb' : 'bg-paper-3'}`}
              >
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-paper rounded-full transition-[left] duration-hover ${available ? 'left-[14px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-2">Tags</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-pill border-[1.5px] text-body-sm font-medium transition-colors duration-hover ${tags.includes(tag) ? 'bg-ink border-ink text-paper' : 'bg-paper border-paper-4 text-ink-5 hover:border-ink-5'}`}
                >
                  {tag}
                </button>
              ))}
              {/* Custom tags */}
              {tags.filter(t => !(PRESET_TAGS as readonly string[]).includes(t)).map(t => (
                <span key={t} className="flex items-center gap-1 px-3 py-1.5 rounded-pill border-[1.5px] bg-ink border-ink text-paper text-body-sm font-medium">
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags(prev => prev.filter(x => x !== t))}
                    className="opacity-60 hover:opacity-100 leading-none ml-0.5"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            {/* Custom tag input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                placeholder="Add custom tag…"
                className="flex-1 text-[13px] text-ink placeholder:text-ink-8 bg-transparent border border-dashed border-paper-4 rounded-1 px-2 py-1 outline-none focus:border-saffron/60 transition-colors"
              />
              <button
                type="button"
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
                className="w-6 h-6 rounded-full bg-paper-3 text-ink flex items-center justify-center disabled:opacity-30 hover:bg-paper-4 transition-colors shrink-0"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* ── Allergens ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-2">Allergens</label>
            <div className="flex gap-2 flex-wrap">
              {ALLERGENS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
                  className={`px-3 py-1.5 rounded-pill border-[1.5px] text-body-sm font-medium transition-colors duration-hover ${allergens.includes(a) ? 'bg-ember border-ember text-paper' : 'bg-paper border-paper-4 text-ink-5 hover:border-ink-5'}`}
                >
                  {a}
                </button>
              ))}
              {/* Custom allergens */}
              {allergens.filter(a => !(ALLERGENS as readonly string[]).includes(a)).map(a => (
                <span key={a} className="flex items-center gap-1 px-3 py-1.5 rounded-pill border-[1.5px] bg-ember border-ember text-paper text-body-sm font-medium">
                  {a}
                  <button
                    type="button"
                    onClick={() => setAllergens(prev => prev.filter(x => x !== a))}
                    className="opacity-60 hover:opacity-100 leading-none ml-0.5"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                value={customAllergenInput}
                onChange={e => setCustomAllergenInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAllergen() } }}
                placeholder="Add custom allergen…"
                className="flex-1 text-[13px] text-ink placeholder:text-ink-8 bg-transparent border border-dashed border-paper-4 rounded-1 px-2 py-1 outline-none focus:border-saffron/60 transition-colors"
              />
              <button
                type="button"
                onClick={addCustomAllergen}
                disabled={!customAllergenInput.trim()}
                className="w-6 h-6 rounded-full bg-paper-3 text-ink flex items-center justify-center disabled:opacity-30 hover:bg-paper-4 transition-colors shrink-0"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* ── Modifier groups ───────────────────────────────────────────── */}
          {isNew ? (
            <p className="text-body-sm text-ink-7 pb-2">
              Save this item first, then reopen it to add modifier groups.
            </p>
          ) : (
            <div className="pb-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-overline text-ink-6 uppercase tracking-widest">Modifiers</label>
                <button
                  type="button"
                  onClick={addGroup}
                  className="flex items-center gap-1 text-[13px] font-medium text-saffron hover:opacity-70 transition-opacity"
                >
                  <Plus size={13} />
                  Add group
                </button>
              </div>

              {groupsLoading && <p className="text-body-sm text-ink-7">Loading…</p>}

              {!groupsLoading && groups.length === 0 && (
                <p className="text-body-sm text-ink-7">
                  No modifiers yet. Add a group to let guests customise this item (e.g. Sauces, Cooking preference).
                </p>
              )}

              <div className="space-y-3">
                {groups.map(group => (
                  <div key={group.id} className="border border-paper-3 rounded-3 p-3.5">
                    {/* Group header */}
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        value={group.name}
                        onChange={e => patchGroupLocal(group.id, { name: e.target.value })}
                        onBlur={() => updateGroup(group.id, { name: group.name })}
                        placeholder="Group name"
                        className="flex-1 text-[14px] font-semibold text-ink bg-transparent border-b border-transparent focus:border-paper-4 outline-none transition-colors pb-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => updateGroup(group.id, { required: !group.required })}
                        title="Required — guest must pick at least one"
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-pill border shrink-0 transition-colors ${group.required ? 'bg-ink border-ink text-paper' : 'bg-paper border-paper-4 text-ink-6 hover:border-ink-6'}`}
                      >
                        Required
                      </button>
                      <button
                        type="button"
                        onClick={() => updateGroup(group.id, { max_selections: group.max_selections === 1 ? null : 1 })}
                        title="Single choice — guest picks exactly one"
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-pill border shrink-0 transition-colors ${group.max_selections === 1 ? 'bg-ink border-ink text-paper' : 'bg-paper border-paper-4 text-ink-6 hover:border-ink-6'}`}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGroup(group.id)}
                        className="text-ink-7 hover:text-ember transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Options list */}
                    <div className="space-y-1.5 mb-2.5">
                      {group.options.map(opt => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            value={opt.name}
                            onChange={e => patchOptionLocal(group.id, opt.id, { name: e.target.value })}
                            onBlur={() => saveOptionName(group.id, opt.id, opt.name)}
                            placeholder="Option name"
                            className="flex-1 text-[13px] text-ink bg-paper-2 rounded-1 px-2 py-1 outline-none focus:ring-1 focus:ring-saffron/40 min-w-0"
                          />
                          <div className="flex items-center gap-0.5 text-[13px] text-ink-6 shrink-0">
                            <span className="font-mono">+</span>
                            <input
                              value={opt.price_cents === 0 ? '' : (opt.price_cents / 100).toFixed(2)}
                              onChange={e => {
                                const cents = e.target.value === '' ? 0 : Math.round(Number(e.target.value) * 100)
                                patchOptionLocal(group.id, opt.id, { price_cents: isNaN(cents) ? 0 : cents })
                              }}
                              onBlur={() => saveOptionPrice(group.id, opt.id, opt.price_cents)}
                              placeholder="0.00"
                              inputMode="decimal"
                              className="w-14 text-[13px] text-ink bg-paper-2 rounded-1 px-1.5 py-1 outline-none focus:ring-1 focus:ring-saffron/40 font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteOption(group.id, opt.id)}
                            className="text-ink-7 hover:text-ember transition-colors shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add option inline */}
                    <div className="flex items-center gap-2">
                      <input
                        value={newOptionText[group.id] ?? ''}
                        onChange={e => setNewOptionText(prev => ({ ...prev, [group.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addOption(group.id) } }}
                        placeholder="Add option…"
                        className="flex-1 text-[13px] text-ink placeholder:text-ink-8 bg-transparent border border-dashed border-paper-4 rounded-1 px-2 py-1 outline-none focus:border-saffron/60 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => addOption(group.id)}
                        disabled={!(newOptionText[group.id] ?? '').trim()}
                        className="w-6 h-6 rounded-full bg-paper-3 text-ink flex items-center justify-center disabled:opacity-30 hover:bg-paper-4 transition-colors shrink-0"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-7 pt-4 pb-8 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-2 border-[1.5px] border-paper-4 bg-paper text-ink text-body font-semibold hover:bg-paper-2 transition-colors duration-hover"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="flex-[2] h-11 rounded-2 bg-saffron text-paper text-body font-semibold disabled:bg-paper-3 disabled:text-ink-7 disabled:cursor-not-allowed transition-colors duration-hover active:scale-[0.98] active:duration-press"
          >
            {isNew ? 'Add to menu' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}

