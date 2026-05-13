import { useEffect, useRef, useState } from 'react'
import { X, Upload, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { AdminMenuCategory } from '../hooks/useAdminMenu'

interface ExtractedItem {
  name: string
  description?: string
  price?: number
  tags?: string[]
  selected: boolean
}

interface ExtractedCategory {
  name: string
  items: ExtractedItem[]
}

interface MenuImportModalProps {
  restaurantId: string
  existingCategories: AdminMenuCategory[]
  onClose: () => void
}

type Step = 'upload' | 'processing' | 'review' | 'done'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_BYTES = 10 * 1024 * 1024

export function MenuImportModal({ restaurantId, existingCategories, onClose }: MenuImportModalProps) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<ExtractedCategory[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function processFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError('File must be under 10 MB')
      return
    }
    const isImage = file.type.startsWith('image/')
    const isPDF = file.type === 'application/pdf'
    if (!isImage && !isPDF) {
      setError('Only JPEG, PNG, WebP, or PDF files are supported')
      return
    }

    setFileName(file.name)
    setError('')
    setStep('processing')

    const base64 = await toBase64(file)
    const apiBase = import.meta.env.VITE_API_BASE_URL as string

    try {
      const res = await fetch(`${apiBase}/api/menu/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, mediaType: file.type, fileBase64: base64 }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Extraction failed')
      }

      const data = await res.json() as { categories: { name: string; items: { name: string; description?: string; price?: number; tags?: string[] }[] }[] }

      setCategories(
        data.categories.map(cat => ({
          name: cat.name,
          items: cat.items.map(it => ({ ...it, selected: true })),
        }))
      )
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('upload')
    }
  }

  function toggleItem(catIdx: number, itemIdx: number) {
    setCategories(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        items: cat.items.map((it, ii) => ii !== itemIdx ? it : { ...it, selected: !it.selected }),
      }
    ))
  }

  function toggleCategory(catIdx: number) {
    setCategories(prev => prev.map((cat, ci) => {
      if (ci !== catIdx) return cat
      const allSelected = cat.items.every(it => it.selected)
      return { ...cat, items: cat.items.map(it => ({ ...it, selected: !allSelected })) }
    }))
  }

  async function importItems() {
    setImporting(true)
    const nextOrder = existingCategories.length

    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci]
      const selected = cat.items.filter(it => it.selected)
      if (selected.length === 0) continue

      // Re-use existing category by name (case-insensitive) or create new
      const existing = existingCategories.find(
        c => c.name.toLowerCase() === cat.name.toLowerCase()
      )

      let categoryId: string
      if (existing) {
        categoryId = existing.id
      } else {
        const { data: newCat } = await supabase
          .from('menu_categories')
          .insert({ restaurant_id: restaurantId, name: cat.name, sort_order: nextOrder + ci })
          .select('id')
          .single()
        if (!newCat) continue
        categoryId = newCat.id
      }

      const baseOrder = existing ? existing.menu_items.length : 0
      await supabase.from('menu_items').insert(
        selected.map((it, ii) => ({
          category_id: categoryId,
          name: it.name,
          description: it.description ?? null,
          price_cents: it.price != null ? Math.round(it.price * 100) : 0,
          available: true,
          tags: it.tags ?? [],
          allergens: [],
          sort_order: baseOrder + ii,
        }))
      )
    }

    await qc.invalidateQueries({ queryKey: ['admin-menu'] })
    setStep('done')
    setImporting(false)
  }

  const totalSelected = categories.reduce((sum, cat) => sum + cat.items.filter(it => it.selected).length, 0)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(26,22,18,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-3 shadow-2 w-full max-w-[560px] mx-5 flex flex-col max-h-[85dvh]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-baseline justify-between px-7 pt-7 pb-1 shrink-0">
          <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Import menu
          </h2>
          <button onClick={onClose} className="text-ink-6 hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="px-7 text-body-sm text-ink-6 mb-5 shrink-0">
          Upload a photo or PDF of your menu — the AI will extract categories and items automatically.
        </p>

        {/* Body */}
        <div className="px-7 pb-7 overflow-y-auto flex-1 min-h-0">

          {/* ── Step: upload ───────────────────────────────────────────── */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) processFile(file)
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-3 py-12 px-6 cursor-pointer transition-colors duration-hover ${
                  dragOver ? 'border-saffron bg-saffron/5' : 'border-paper-4 hover:border-paper-5 bg-paper-2'
                }`}
              >
                <Upload size={28} className="text-ink-6" />
                <div className="text-center">
                  <p className="text-body font-semibold text-ink">Drop your menu here</p>
                  <p className="text-body-sm text-ink-6 mt-0.5">JPEG, PNG, WebP or PDF · max 10 MB</p>
                </div>
                <span className="px-4 py-2 rounded-2 border border-paper-4 text-body-sm text-ink font-medium bg-paper hover:bg-paper-2 transition-colors duration-hover">
                  Browse file
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
              />
              {error && <p className="text-body-sm text-ember mt-3">{error}</p>}
            </div>
          )}

          {/* ── Step: processing ───────────────────────────────────────── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-body font-semibold text-ink">Analysing menu…</p>
                <p className="text-body-sm text-ink-6 mt-0.5">{fileName}</p>
              </div>
            </div>
          )}

          {/* ── Step: review ───────────────────────────────────────────── */}
          {step === 'review' && (
            <div>
              <p className="text-body-sm text-ink-6 mb-4">
                Deselect anything you don't want to import, then click the button below.
              </p>
              <div className="space-y-4">
                {categories.map((cat, ci) => {
                  const allSelected = cat.items.every(it => it.selected)
                  const someSelected = cat.items.some(it => it.selected)
                  return (
                    <div key={ci}>
                      {/* Category row */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(ci)}
                        className="flex items-center gap-2 mb-2 group w-full text-left"
                      >
                        <span
                          className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                            allSelected ? 'bg-ink border-ink' : someSelected ? 'bg-paper-3 border-paper-4' : 'bg-paper border-paper-4'
                          }`}
                        >
                          {allSelected && <Check size={10} className="text-paper" strokeWidth={3} />}
                          {someSelected && !allSelected && <span className="w-1.5 h-1.5 rounded-sm bg-ink-5" />}
                        </span>
                        <span className="text-overline text-ink-6 uppercase tracking-widest">{cat.name}</span>
                      </button>

                      {/* Items */}
                      <div className="space-y-1 pl-6">
                        {cat.items.map((it, ii) => (
                          <button
                            key={ii}
                            type="button"
                            onClick={() => toggleItem(ci, ii)}
                            className="flex items-start gap-2.5 w-full text-left py-1.5 group"
                          >
                            <span
                              className={`w-4 h-4 mt-0.5 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                                it.selected ? 'bg-ink border-ink' : 'bg-paper border-paper-4 group-hover:border-paper-5'
                              }`}
                            >
                              {it.selected && <Check size={10} className="text-paper" strokeWidth={3} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className={`text-[14px] font-medium leading-tight ${it.selected ? 'text-ink' : 'text-ink-6'}`}>
                                  {it.name}
                                </span>
                                {it.price != null && (
                                  <span className="font-mono text-[13px] text-ink-6 shrink-0">
                                    {it.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {it.description && (
                                <p className="text-[12px] text-ink-7 mt-0.5 leading-snug">{it.description}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2.5 mt-6 pt-5 border-t border-paper-3 sticky bottom-0 bg-paper pb-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-2 border-[1.5px] border-paper-4 bg-paper text-ink text-body font-semibold hover:bg-paper-2 transition-colors duration-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={importItems}
                  disabled={totalSelected === 0 || importing}
                  className="flex-[2] h-11 rounded-2 bg-saffron text-paper text-body font-semibold disabled:bg-paper-3 disabled:text-ink-7 disabled:cursor-not-allowed transition-colors duration-hover"
                >
                  {importing ? 'Importing…' : `Import ${totalSelected} item${totalSelected === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: done ─────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-12 h-12 rounded-full bg-herb/15 flex items-center justify-center">
                <Check size={22} className="text-herb" strokeWidth={2.5} />
              </div>
              <div className="text-center">
                <p className="text-body font-semibold text-ink">Import complete</p>
                <p className="text-body-sm text-ink-6 mt-1">
                  {totalSelected} item{totalSelected === 1 ? '' : 's'} added to your menu.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 h-10 rounded-2 bg-ink text-paper text-body font-semibold hover:opacity-80 transition-opacity mt-2"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix: "data:image/jpeg;base64,..."
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
