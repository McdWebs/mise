import { useEffect, useRef, useState } from 'react'
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
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuFor) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuFor])

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

  async function deleteCategory(cat: AdminMenuCategory) {
    const n = cat.menu_items.length
    const msg =
      n > 0
        ? `Delete “${cat.name}” and all ${n} item(s) in it? This cannot be undone.`
        : `Delete empty category “${cat.name}”?`
    if (!window.confirm(msg)) return

    const { error } = await supabase.from('menu_categories').delete().eq('id', cat.id)
    if (error) {
      window.alert(
        error.message ||
          'Could not delete this category. Items may still be linked to past orders — remove or reassign them first.'
      )
      return
    }

    const remaining = categories.filter(c => c.id !== cat.id)
    onLocalReorder(remaining)
    if (cat.id === activeCategoryId) {
      onSelect(remaining[0]?.id ?? '')
    }
    setMenuFor(null)

    await Promise.all(
      remaining.map((c, idx) =>
        supabase.from('menu_categories').update({ sort_order: idx }).eq('id', c.id)
      )
    )
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
              gridTemplateColumns: '14px 1fr auto 32px',
              opacity: isDragging ? 0.4 : 1,
              borderTop: isOver ? '2px solid var(--saffron)' : undefined,
            }}
          >
            <span className="text-[12px] text-ink-7 cursor-grab leading-none select-none" title="Drag to reorder">⋮⋮</span>
            <span className="text-body font-medium min-w-0 truncate">{cat.name}</span>
            <span className={`font-mono text-[12px] tabular-nums ${cat.id === activeCategoryId ? 'text-ink-8' : 'text-ink-6'}`}>
              {cat.menu_items.length}
            </span>
            <div
              className="relative flex justify-center"
              ref={menuFor === cat.id ? menuRef : undefined}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setMenuFor(menuFor === cat.id ? null : cat.id)
                }}
                className={`font-bold text-[18px] px-1 leading-none transition-colors duration-hover ${
                  cat.id === activeCategoryId ? 'text-ink-8 hover:text-paper' : 'text-ink-7 hover:text-ink'
                }`}
              >
                ⋯
              </button>
              {menuFor === cat.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute top-full right-0 z-20 mt-1 min-w-[180px] bg-paper border border-paper-3 rounded-3 shadow-1 p-1.5 text-left"
                >
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat)}
                    className="w-full text-left px-3 py-2.5 rounded-2 text-body-sm text-ember hover:bg-ember-wash transition-colors duration-hover"
                  >
                    Delete category
                  </button>
                </div>
              )}
            </div>
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
