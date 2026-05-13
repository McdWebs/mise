import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { formatPriceExact } from '@/features/guest/utils/formatPrice'
import { ConfirmModal } from './ConfirmModal'
import type { AdminMenuItem, AdminMenuCategory } from '../hooks/useAdminMenu'

interface MenuItemTableProps {
  items: AdminMenuItem[]
  categories: AdminMenuCategory[]
  activeCategoryId: string
  categoryName: string
  currency: string
  onEdit: (item: AdminMenuItem) => void
  onAdd: () => void
  onLocalReorder: (sorted: AdminMenuItem[]) => void
}

export function MenuItemTable({
  items,
  categories,
  activeCategoryId,
  categoryName,
  currency,
  onEdit,
  onAdd,
  onLocalReorder,
}: MenuItemTableProps) {
  const qc = useQueryClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminMenuItem | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
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

  function onDragStart(id: string) { setDragId(id) }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== overId) setOverId(id)
  }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const from = items.findIndex(i => i.id === dragId)
    const to   = items.findIndex(i => i.id === targetId)
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return }
    const sorted = items.slice()
    const [moved] = sorted.splice(from, 1)
    sorted.splice(to, 0, moved)
    onLocalReorder(sorted)
    setDragId(null); setOverId(null)
    await Promise.all(sorted.map((item, idx) =>
      supabase.from('menu_items').update({ sort_order: idx }).eq('id', item.id)
    ))
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
  }
  function onDragEnd() { setDragId(null); setOverId(null) }

  async function toggleAvailable(item: AdminMenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
  }

  async function duplicate(item: AdminMenuItem) {
    await supabase.from('menu_items').insert({
      category_id: item.category_id,
      name: `${item.name} (copy)`,
      description: item.description,
      price_cents: item.price_cents,
      available: item.available,
      tags: item.tags,
      sort_order: items.length,
    })
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setMenuFor(null)
  }

  async function moveToCategory(item: AdminMenuItem, targetCategoryId: string) {
    await supabase.from('menu_items').update({
      category_id: targetCategoryId,
      sort_order: 9999,
    }).eq('id', item.id)
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setMenuFor(null)
  }

  async function deleteItem(item: AdminMenuItem) {
    await supabase.from('menu_items').delete().eq('id', item.id)
    qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setMenuFor(null)
    setPendingDelete(null)
  }

  return (
    <div>
      {items.map(item => {
        const isDragging = dragId === item.id
        const isOver = overId === item.id && dragId !== item.id
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragOver={e => onDragOver(e, item.id)}
            onDrop={e => onDrop(e, item.id)}
            onDragEnd={onDragEnd}
            onClick={() => onEdit(item)}
            className="grid items-center gap-4 px-1 py-3 border-b border-paper-3 hover:bg-paper-2 transition-colors duration-hover cursor-pointer"
            style={{
              gridTemplateColumns: '18px 1fr 90px 80px 40px',
              opacity: isDragging ? 0.4 : 1,
              background: isOver ? 'var(--saffron-wash)' : undefined,
              borderTop: isOver ? '2px solid var(--saffron)' : undefined,
            }}
          >
            {/* Drag handle */}
            <span
              className="text-ink-7 cursor-grab text-[14px] leading-none select-none"
              title="Drag to reorder"
              onClick={e => e.stopPropagation()}
            >
              ⋮⋮
            </span>

            {/* Name + desc */}
            <div className="min-w-0">
              <div className="font-display text-[16px] font-[500] text-ink leading-tight">{item.name}</div>
              {item.description && (
                <div className="text-body-sm text-ink-6 mt-0.5 truncate">{item.description}</div>
              )}
            </div>

            {/* Price */}
            <div className="font-mono font-semibold text-ink">
              {formatPriceExact(item.price_cents, currency)}
            </div>

            {/* Available toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={item.available}
              onClick={e => {
                e.stopPropagation()
                void toggleAvailable(item)
              }}
              className={`w-8 h-[18px] rounded-pill relative transition-colors duration-hover ${item.available ? 'bg-herb' : 'bg-paper-3'}`}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 bg-paper rounded-full transition-[left] duration-hover ${item.available ? 'left-[14px]' : 'left-0.5'}`}
              />
            </button>

            {/* ⋯ context menu */}
            <div className="relative flex justify-center" ref={menuFor === item.id ? menuRef : undefined}>
              <button
                onClick={e => { e.stopPropagation(); setMenuFor(menuFor === item.id ? null : item.id) }}
                className="text-ink-7 font-bold text-[18px] px-1 hover:text-ink transition-colors duration-hover leading-none"
              >
                ⋯
              </button>
              {menuFor === item.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute top-full right-0 z-20 mt-1 min-w-[200px] bg-paper border border-paper-3 rounded-3 shadow-1 p-1.5 text-left"
                >
                  {[
                    { label: 'Edit item', action: () => { onEdit(item); setMenuFor(null) } },
                    { label: 'Duplicate', action: () => duplicate(item) },
                    { label: item.available ? 'Mark unavailable' : 'Mark available', action: () => { toggleAvailable(item); setMenuFor(null) } },
                  ].map(o => (
                    <button
                      key={o.label}
                      onClick={o.action}
                      className="w-full text-left px-3 py-2.5 rounded-2 text-body-sm text-ink hover:bg-paper-2 transition-colors duration-hover"
                    >
                      {o.label}
                    </button>
                  ))}

                  {/* Move to category */}
                  {categories.filter(c => c.id !== activeCategoryId).length > 0 && (
                    <div className="group relative">
                      <button className="w-full text-left px-3 py-2.5 rounded-2 text-body-sm text-ink hover:bg-paper-2 transition-colors duration-hover">
                        Move to category…
                      </button>
                      <div className="absolute left-full top-0 ml-1 hidden group-hover:block min-w-[160px] bg-paper border border-paper-3 rounded-3 shadow-1 p-1.5">
                        {categories
                          .filter(c => c.id !== activeCategoryId)
                          .map(c => (
                            <button
                              key={c.id}
                              onClick={() => moveToCategory(item, c.id)}
                              className="w-full text-left px-3 py-2 rounded-2 text-body-sm text-ink hover:bg-paper-2 transition-colors duration-hover"
                            >
                              {c.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-paper-3 my-1.5 mx-1.5" />
                  <button
                    onClick={() => { setPendingDelete(item); setMenuFor(null) }}
                    className="w-full text-left px-3 py-2.5 rounded-2 text-body-sm text-ember hover:bg-ember-wash transition-colors duration-hover"
                  >
                    Delete item
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Add item row */}
      <button
        onClick={onAdd}
        className="w-full grid gap-4 px-1 py-3.5 text-left text-body-sm text-ink-6 hover:text-ink-5 transition-colors duration-hover"
        style={{ gridTemplateColumns: '18px 1fr 90px 80px 40px' }}
      >
        <span />
        <span>+ Add item to {categoryName.toLowerCase()}</span>
      </button>

      {pendingDelete && (
        <ConfirmModal
          title="Delete item"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete item"
          onConfirm={() => deleteItem(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
