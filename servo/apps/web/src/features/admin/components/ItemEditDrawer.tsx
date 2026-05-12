import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { AdminMenuItem } from '../hooks/useAdminMenu'

const TAGS = ['Vegetarian', 'Gluten-free', 'Spicy'] as const

interface ItemEditDrawerProps {
  open: boolean
  categoryId: string
  categoryName: string
  item?: AdminMenuItem | null
  onClose: () => void
}

export function ItemEditDrawer({ open, categoryId, categoryName, item, onClose }: ItemEditDrawerProps) {
  const qc = useQueryClient()
  const isNew = !item

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)

  // Sync state when item prop changes
  useEffect(() => {
    if (item) {
      setName(item.name)
      setDesc(item.description ?? '')
      setPrice((item.price_cents / 100).toFixed(2))
      setTags(item.tags ?? [])
      setAvailable(item.available)
    } else {
      setName(''); setDesc(''); setPrice(''); setTags([]); setAvailable(true)
    }
  }, [item, open])

  // Close on Escape
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
        sort_order: 9999,
      })
    } else {
      await supabase.from('menu_items').update({
        name: name.trim(),
        description: desc.trim() || null,
        price_cents,
        available,
        tags,
      }).eq('id', item!.id)
    }

    await qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setSaving(false)
    onClose()
  }

  function toggleTag(tag: string) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[480px] z-50 bg-paper flex flex-col shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between px-7 pt-7 pb-1.5">
          <h2 className="font-display text-[26px] font-[500] text-ink leading-none tracking-[-0.01em] font-optical">
            {isNew ? 'New item' : 'Edit item'}
          </h2>
          <button onClick={onClose} className="text-ink-6 hover:text-ink text-[22px] leading-none">
            <X size={20} />
          </button>
        </div>
        <p className="px-7 text-body-sm text-ink-6 mb-5">
          {isNew ? 'Adding to' : 'In'} <strong className="text-ink font-semibold">{categoryName}</strong>
        </p>

        {/* Form */}
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

          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-1.5">Price (CAD)</label>
            <div className="flex items-center border-[1.5px] border-paper-4 rounded-2 px-3 max-w-[180px] focus-within:border-saffron transition-[border-color] duration-standard">
              <span className="font-mono text-ink-6 mr-1">$</span>
              <input
                value={price}
                onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                inputMode="decimal"
                className="flex-1 py-2.5 font-mono text-body text-ink bg-transparent focus-visible:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-overline text-ink-6 uppercase tracking-widest mb-2">Tags</label>
            <div className="flex gap-2 flex-wrap">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-pill border-[1.5px] text-body-sm font-medium transition-colors duration-hover ${tags.includes(tag) ? 'bg-ink border-ink text-paper' : 'bg-paper border-paper-4 text-ink-5 hover:border-ink-5'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Available toggle */}
          <div className="flex items-center justify-between p-4 bg-paper-2 rounded-3">
            <div>
              <p className="text-body font-semibold text-ink">Available to order</p>
              <p className="text-body-sm text-ink-6">Toggle off to hide without deleting.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={available}
              onClick={() => setAvailable(v => !v)}
              className={`w-8 h-[18px] rounded-pill relative transition-colors duration-hover ${available ? 'bg-herb' : 'bg-paper-3'}`}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 bg-paper rounded-full transition-[left] duration-hover ${available ? 'left-[14px]' : 'left-0.5'}`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-7 pt-4 pb-8">
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
