import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { AdminMenuCategory } from '../hooks/useAdminMenu'

interface MenuCategoryListProps {
  categories: AdminMenuCategory[]
  activeCategoryId: string
  onSelect: (id: string) => void
  onLocalReorder: (sorted: AdminMenuCategory[]) => void
}

export function MenuCategoryList({
  categories,
  activeCategoryId,
  onSelect,
  onLocalReorder,
}: MenuCategoryListProps) {
  const qc = useQueryClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [addingName, setAddingName] = useState('')
  const [adding, setAdding] = useState(false)

  function onDragStart(id: string) {
    setDragId(id)
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== overId) setOverId(id)
  }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const from = categories.findIndex(c => c.id === dragId)
    const to   = categories.findIndex(c => c.id === targetId)
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return }
    const sorted = categories.slice()
    const [moved] = sorted.splice(from, 1)
    sorted.splice(to, 0, moved)
    onLocalReorder(sorted)
    setDragId(null); setOverId(null)
    // Persist
    await Promise.all(sorted.map((cat, idx) =>
      supabase.from('menu_categories').update({ sort_order: idx }).eq('id', cat.id)
    ))
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
  }
  function onDragEnd() { setDragId(null); setOverId(null) }

  async function addCategory() {
    const name = addingName.trim()
    if (!name) return
    const nextOrder = categories.length
    await supabase.from('menu_categories').insert({
      restaurant_id: categories[0]?.restaurant_id ?? '',
      name,
      sort_order: nextOrder,
    })
    setAddingName('')
    setAdding(false)
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
  }

  return (
    <div className="flex flex-col gap-0.5">
      {categories.map(cat => {
        const isDragging = dragId === cat.id
        const isOver = overId === cat.id && dragId !== cat.id
        return (
          <div
            key={cat.id}
            draggable
            onDragStart={() => onDragStart(cat.id)}
            onDragOver={e => onDragOver(e, cat.id)}
            onDrop={e => onDrop(e, cat.id)}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(cat.id)}
            className={`grid items-center gap-2 px-3 py-2.5 rounded-2 cursor-pointer transition-all duration-hover select-none ${cat.id === activeCategoryId ? 'bg-ink text-paper' : 'text-ink-5 hover:bg-paper-2 hover:text-ink'}`}
            style={{
              gridTemplateColumns: '14px 1fr auto',
              opacity: isDragging ? 0.4 : 1,
              borderTop: isOver ? '2px solid var(--saffron)' : undefined,
            }}
          >
            <span className="text-[12px] text-ink-7 cursor-grab leading-none select-none" title="Drag to reorder">⋮⋮</span>
            <span className="text-body font-medium">{cat.name}</span>
            <span className={`font-mono text-[12px] ${cat.id === activeCategoryId ? 'text-ink-8' : 'text-ink-6'}`}>
              {cat.menu_items.length}
            </span>
          </div>
        )
      })}

      {adding ? (
        <div className="px-3 py-2">
          <input
            autoFocus
            value={addingName}
            onChange={e => setAddingName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Category name"
            className="w-full px-2 py-1.5 border-[1.5px] border-saffron rounded-1 text-body text-ink bg-paper focus-visible:outline-none text-[14px]"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-2.5 text-left text-body-sm text-ink-6 hover:text-ink-5 transition-colors duration-hover"
        >
          + Add category
        </button>
      )}
    </div>
  )
}
