import { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Check, Download, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { Sk } from '@/features/admin/components/Skeleton'
import { upsertTableStatus } from '../hooks/useTables'
import type { TableWithStatus } from '../hooks/useTables'
import type { WaiterCall } from '../hooks/useWaiterCalls'

function QRCodeSection({ slug, tableLabel }: { slug: string; tableLabel: string }) {
  const url = `${window.location.origin}/r/${slug}?table=${encodeURIComponent(tableLabel)}`
  const canvasId = `qr-${tableLabel}`

  function download() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `table-${tableLabel}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="flex items-start gap-4">
      <div className="bg-white p-2 rounded-2 shrink-0">
        <QRCodeCanvas
          id={canvasId}
          value={url}
          size={100}
          bgColor="#ffffff"
          fgColor="#111111"
          level="M"
        />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <p className="font-mono text-[11px] text-ink-5 break-all leading-relaxed">{url}</p>
        <button
          onClick={download}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2 bg-ink text-paper text-[12px] font-medium hover:bg-ink-2 transition-colors duration-hover w-fit"
        >
          <Download size={12} />
          Download PNG
        </button>
      </div>
    </div>
  )
}

interface ActiveOrder {
  id: string
  table_label: string
  stage: string
  subtotal_cents: number
  order_items: {
    id: string
    quantity: number
    menu_item_id: string | null
    restaurant_plan_id: string | null
    menu_items: { name: string } | null
    restaurant_plans: { title: string } | null
  }[]
}

const STAGE_LABEL: Record<string, string> = {
  received: 'Incoming',
  cooking: 'Cooking',
  ready: 'Ready',
}

const STAGE_COLOR: Record<string, string> = {
  received: 'text-saffron',
  cooking: 'text-honey',
  ready: 'text-herb',
}

function ActiveOrdersSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading orders">
      {[0, 1].map(i => (
        <div key={i} className="bg-paper-2 rounded-2 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <Sk className="h-3 w-24" />
            <Sk className="h-3 w-14" />
          </div>
          <Sk className="h-3.5 w-full max-w-[200px]" />
          <Sk className="h-3.5 w-full max-w-[140px]" />
        </div>
      ))}
    </div>
  )
}

interface TableDrawerProps {
  table: TableWithStatus | null
  allTables: TableWithStatus[]
  restaurantId: string
  restaurantSlug: string
  calls: WaiterCall[]
  onAckCall: (id: string) => Promise<void>
  onClose: () => void
  onMutated?: () => void | Promise<void>
}

export function TableDrawer({ table, allTables, restaurantId, restaurantSlug, calls, onAckCall, onClose, onMutated }: TableDrawerProps) {
  const open = table !== null
  /** `table` from parent is a new object on every useTables refetch; memoize query inputs so the fetch effect does not re-run. */
  const mergedLabelsSig = table?.merged_secondary_labels.join('\x1e') ?? ''
  const orderQueryLabels = useMemo((): string[] | null => {
    if (!table) return null
    return [table.label, ...table.merged_secondary_labels]
  }, [table?.id, table?.label, mergedLabelsSig])
  const [waiterName, setWaiterName] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editingSeats, setEditingSeats] = useState(4)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    setSaveError(null)
  }, [table?.id])

  useEffect(() => {
    if (!table) return
    setEditingLabel(table.label)
    setEditingSeats(table.seats)
    setEditMode(false)
    setMergeTarget('')
  }, [table?.id])

  useEffect(() => {
    if (!table) return
    setWaiterName(table.status?.waiter_name ?? '')
  }, [table?.id, table?.status?.waiter_name])

  useEffect(() => {
    if (!orderQueryLabels) {
      setActiveOrders([])
      setActiveOrdersLoading(false)
      return
    }
    const labels = orderQueryLabels
    let cancelled = false
    setActiveOrdersLoading(true)
    setActiveOrders([])
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, table_label, stage, subtotal_cents, order_items(*, menu_items(name))')
          .eq('restaurant_id', restaurantId)
          .in('table_label', labels)
          .in('stage', ['received', 'cooking', 'ready'])
          .order('created_at', { ascending: false })
        if (cancelled) return
        if (error || !data) {
          setActiveOrders([])
          return
        }
        type RawRow = Omit<ActiveOrder, 'order_items'> & {
          order_items: Omit<ActiveOrder['order_items'][number], 'restaurant_plans'>[]
        }
        const rows = data as unknown as RawRow[]
        const planIds = new Set<string>()
        for (const o of rows) {
          for (const li of o.order_items) {
            if (li.restaurant_plan_id) planIds.add(li.restaurant_plan_id)
          }
        }
        const planById = new Map<string, { title: string }>()
        if (planIds.size > 0) {
          const { data: plans } = await supabase
            .from('restaurant_plans')
            .select('id, title')
            .in('id', [...planIds])
          for (const p of plans ?? []) planById.set(p.id, { title: p.title })
        }
        if (cancelled) return
        const enriched: ActiveOrder[] = rows.map(o => ({
          ...o,
          order_items: o.order_items.map(li => ({
            ...li,
            restaurant_plans:
              li.restaurant_plan_id && planById.has(li.restaurant_plan_id)
                ? planById.get(li.restaurant_plan_id)!
                : null,
          })),
        }))
        setActiveOrders(enriched)
      } finally {
        if (!cancelled) setActiveOrdersLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setActiveOrdersLoading(false)
    }
  }, [orderQueryLabels, restaurantId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function notifyMutated() {
    await onMutated?.()
  }

  async function saveWaiter() {
    if (!table) return
    setSaving(true)
    setSaveError(null)
    const { error } = await upsertTableStatus(table.id, restaurantId, { waiter_name: waiterName.trim() || null })
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    await notifyMutated()
    setSaving(false)
  }

  async function saveEdit() {
    if (!table || !editingLabel.trim()) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('tables').update({ label: editingLabel.trim(), seats: editingSeats }).eq('id', table.id)
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    await notifyMutated()
    setSaving(false)
    setEditMode(false)
  }

  async function handleMerge() {
    if (!table || !mergeTarget) return
    setSaving(true)
    setSaveError(null)
    const { error } = await upsertTableStatus(mergeTarget, restaurantId, { merged_into: table.id })
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    await notifyMutated()
    setSaving(false)
    setMergeTarget('')
  }

  async function handleUnmerge(secondaryId: string) {
    setSaving(true)
    setSaveError(null)
    const { error } = await upsertTableStatus(secondaryId, restaurantId, { merged_into: null })
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    await notifyMutated()
    setSaving(false)
  }

  async function clearTable() {
    if (!table) return
    setSaving(true)
    setSaveError(null)
    const now = new Date().toISOString()
    const w = await upsertTableStatus(table.id, restaurantId, { waiter_name: null, cleared_at: now, occupied_since: null })
    if (w.error) {
      setSaveError(w.error.message)
      setSaving(false)
      return
    }
    for (const sid of table.merged_secondary_ids) {
      const u = await upsertTableStatus(sid, restaurantId, { merged_into: null })
      if (u.error) {
        setSaveError(u.error.message)
        setSaving(false)
        return
      }
    }
    await notifyMutated()
    setSaving(false)
    onClose()
  }

  async function deleteTable() {
    if (!table) return
    if (!confirm(`Delete table "${table.label}"? This cannot be undone.`)) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('tables').delete().eq('id', table.id)
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    await notifyMutated()
    setSaving(false)
    onClose()
  }

  const mergeOptions = allTables.filter(t =>
    t.id !== table?.id &&
    !t.status?.merged_into &&
    !(table?.merged_secondary_ids ?? []).includes(t.id)
  )

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink/60 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-96 z-50 bg-paper flex flex-col shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-paper-3 shrink-0">
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-2 pr-2">
                <input
                  value={editingLabel}
                  onChange={e => setEditingLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                  placeholder="Table label"
                  autoFocus
                  className="w-full font-mono text-[18px] font-bold bg-paper-2 rounded-2 px-3 py-1.5 border border-paper-4 text-ink outline-none focus:border-saffron transition-[border-color] duration-standard"
                />
                <div className="flex items-center gap-2">
                  <label className="text-body-sm text-ink-5 shrink-0">Seats</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editingSeats}
                    onChange={e => setEditingSeats(Number(e.target.value))}
                    className="w-16 font-mono text-body bg-paper-2 rounded-2 px-2 py-1.5 border border-paper-4 text-ink outline-none focus:border-saffron transition-[border-color] duration-standard"
                  />
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editingLabel.trim()}
                    className="px-3 py-1 bg-ink text-paper rounded-pill text-body-sm font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-3 py-1 text-ink-5 rounded-pill text-body-sm hover:text-ink transition-colors duration-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="text-left hover:opacity-70 transition-opacity duration-hover"
              >
                <p className="font-mono text-[22px] font-bold text-ink leading-none">{table?.label}</p>
                <p className="text-body-sm text-ink-5 mt-0.5">{table?.seats} seats · tap to edit</p>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-2 text-ink-6 hover:text-ink hover:bg-paper-2 transition-colors duration-hover ml-2 shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {saveError && (
          <div className="shrink-0 px-5 py-2.5 bg-ember/10 border-b border-ember/25 text-body-sm text-ember">
            {saveError}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-paper-3">
          {/* Pending waiter calls */}
          {calls.length > 0 && (
            <div className="px-5 py-4 bg-ember-wash">
              <p className="text-body-sm font-semibold text-ember mb-2.5">
                {calls.length === 1 ? 'Waiter called' : `${calls.length} waiter calls`}
              </p>
              <div className="space-y-2">
                {calls.map(call => (
                  <div key={call.id} className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] text-ink-5">
                      {new Date(call.called_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                      {call.table_label !== table?.label && (
                        <span className="ml-1 text-ink-7">({call.table_label})</span>
                      )}
                    </span>
                    <button
                      onClick={() => onAckCall(call.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-ember text-paper rounded-pill text-[11px] font-semibold hover:opacity-90 transition-opacity duration-hover"
                    >
                      <Check size={10} />
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiter assignment */}
          <div className="px-5 py-4">
            <p className="text-body-sm font-semibold text-ink mb-2.5">Waiter</p>
            <div className="flex gap-2">
              <input
                value={waiterName}
                onChange={e => setWaiterName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveWaiter() }}
                placeholder="Assign waiter…"
                className="flex-1 bg-paper-2 border border-paper-4 rounded-2 px-3 py-2 text-body text-ink placeholder:text-ink-8 outline-none focus:border-saffron transition-[border-color] duration-standard"
              />
              <button
                onClick={saveWaiter}
                disabled={saving}
                className="px-4 rounded-2 bg-ink text-paper text-body-sm font-medium disabled:opacity-50 transition-opacity duration-hover hover:bg-ink-2"
              >
                Save
              </button>
            </div>
          </div>

          {/* Merge tables */}
          {!table?.status?.merged_into && (
            <div className="px-5 py-4">
              <p className="text-body-sm font-semibold text-ink mb-2.5">Merge tables</p>

              {table && table.merged_secondary_ids.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {table.merged_secondary_ids.map((sid, i) => (
                    <div key={sid} className="flex items-center justify-between bg-paper-2 rounded-2 px-3 py-2">
                      <span className="font-mono text-body-sm font-semibold text-ink">
                        {table.merged_secondary_labels[i]}
                      </span>
                      <button
                        onClick={() => handleUnmerge(sid)}
                        disabled={saving}
                        className="text-[11px] text-ink-5 hover:text-ember transition-colors duration-hover disabled:opacity-50"
                      >
                        Unmerge
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mergeOptions.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={mergeTarget}
                    onChange={e => setMergeTarget(e.target.value)}
                    className="flex-1 bg-paper-2 border border-paper-4 rounded-2 px-3 py-2 text-body text-ink outline-none focus:border-saffron transition-[border-color] duration-standard"
                  >
                    <option value="">Add table to merge…</option>
                    {mergeOptions.map(t => (
                      <option key={t.id} value={t.id}>{t.label} ({t.seats} seats)</option>
                    ))}
                  </select>
                  <button
                    onClick={handleMerge}
                    disabled={!mergeTarget || saving}
                    className="px-4 rounded-2 bg-ink text-paper text-body-sm font-medium disabled:opacity-30 transition-opacity duration-hover hover:bg-ink-2"
                  >
                    Merge
                  </button>
                </div>
              ) : (
                <p className="text-body-sm text-ink-5">No other tables available to merge.</p>
              )}
            </div>
          )}

          {/* Merged-into indicator */}
          {table?.status?.merged_into && (
            <div className="px-5 py-4">
              <p className="text-body-sm font-semibold text-ink mb-2.5">Merged into</p>
              <div className="flex items-center justify-between bg-paper-2 rounded-2 px-3 py-2">
                <span className="font-mono text-body-sm font-semibold text-ink">
                  {allTables.find(t => t.id === table.status?.merged_into)?.label ?? '—'}
                </span>
                <button
                  onClick={() => table && handleUnmerge(table.id)}
                  disabled={saving}
                  className="text-[11px] text-ink-5 hover:text-ember transition-colors duration-hover disabled:opacity-50"
                >
                  Unmerge
                </button>
              </div>
            </div>
          )}

          {/* QR code */}
          {table && (
            <div className="px-5 py-4">
              <p className="text-body-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
                <QrCode size={14} className="text-ink-5" />
                Table QR code
              </p>
              <QRCodeSection slug={restaurantSlug} tableLabel={table.label} />
            </div>
          )}

          {/* Active orders */}
          <div className="px-5 py-4">
            <p className="text-body-sm font-semibold text-ink mb-2.5">
              Active orders
              {!activeOrdersLoading && activeOrders.length > 0 && ` (${activeOrders.length})`}
            </p>
            {activeOrdersLoading ? (
              <ActiveOrdersSkeleton />
            ) : activeOrders.length === 0 ? (
              <p className="text-body-sm text-ink-5">No active orders.</p>
            ) : (
              <div className="space-y-3">
                {activeOrders.map(order => (
                  <div key={order.id} className="bg-paper-2 rounded-2 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[11px] text-ink-5">
                        #{order.id.slice(-4).toUpperCase()}
                        {order.table_label !== table?.label && (
                          <span className="ml-1 text-ink-7">· {order.table_label}</span>
                        )}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-widest ${STAGE_COLOR[order.stage] ?? 'text-ink-6'}`}>
                        {STAGE_LABEL[order.stage] ?? order.stage}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {order.order_items.map(item => (
                        <p key={item.id} className="text-body-sm text-ink-6">
                          {item.quantity}× {item.menu_items?.name ?? item.restaurant_plans?.title ?? '—'}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-paper-3 space-y-2 shrink-0">
          <button
            onClick={clearTable}
            disabled={saving}
            className="w-full h-10 rounded-2 bg-paper-2 text-ink text-body-sm font-medium transition-colors duration-hover hover:bg-paper-3 disabled:opacity-50"
          >
            Clear table
          </button>
          <button
            onClick={deleteTable}
            disabled={saving}
            className="w-full h-10 rounded-2 border border-paper-4 text-ink-5 text-body-sm font-medium flex items-center justify-center gap-2 transition-colors duration-hover hover:border-ember hover:text-ember disabled:opacity-50"
          >
            <Trash2 size={13} />
            Delete table
          </button>
        </div>
      </div>
    </>
  )
}
