import { useState, useCallback } from 'react'
import { Plus, BellRing, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTables } from '@/features/kitchen/hooks/useTables'
import { useWaiterCalls } from '@/features/kitchen/hooks/useWaiterCalls'
import { TableDrawer } from '@/features/kitchen/components/TableDrawer'
import type { TableWithStatus } from '@/features/kitchen/hooks/useTables'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateLabels(prefix: string, from: number, to: number): string[] {
  if (from > to || to - from > 199) return []
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`)
}

function previewText(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length <= 5) return labels.join(', ')
  return `${labels.slice(0, 3).join(', ')} … ${labels[labels.length - 1]}`
}

// ── Bulk create panel ──────────────────────────────────────────────────────────

function BulkCreatePanel({
  restaurantId,
  sortOrderBase,
  onClose,
  onCreated,
}: {
  restaurantId: string
  sortOrderBase: number
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [prefix, setPrefix] = useState('T ')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(10)
  const [seats, setSeats] = useState(4)
  const [saving, setSaving] = useState(false)

  const labels = generateLabels(prefix, from, to)
  const count = labels.length
  const valid = count > 0 && prefix.trim() !== ''

  async function handleCreate() {
    if (!valid) return
    setSaving(true)
    try {
      await supabase.from('tables').insert(
        labels.map((label, i) => ({
          restaurant_id: restaurantId,
          label,
          seats,
          sort_order: sortOrderBase + i,
        }))
      )
      await onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const fieldCls =
    'bg-paper border-[1.5px] border-paper-4 rounded-2 px-3 py-2 text-body text-ink outline-none focus:border-saffron transition-[border-color] duration-standard font-mono'

  return (
    <div className="bg-paper-2 border border-paper-3 rounded-3 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-overline text-ink-6 uppercase tracking-widest">Bulk create tables</p>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-1 text-ink-6 hover:text-ink transition-colors duration-hover"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6 font-medium">Prefix</label>
          <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="T " className={`${fieldCls} w-24`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6 font-medium">From</label>
          <input type="number" min="1" value={from} onChange={e => setFrom(Math.max(1, Number(e.target.value)))} className={`${fieldCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6 font-medium">To</label>
          <input type="number" min="1" value={to} onChange={e => setTo(Math.max(1, Number(e.target.value)))} className={`${fieldCls} w-20`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6 font-medium">Seats each</label>
          <input type="number" min="1" max="50" value={seats} onChange={e => setSeats(Math.max(1, Number(e.target.value)))} className={`${fieldCls} w-20`} />
        </div>
      </div>

      {count > 0 && (
        <p className="mt-4 text-[12px] text-ink-6 font-mono">
          <span className="text-ink-5">{count} tables: </span>
          {previewText(labels)}
        </p>
      )}
      {count === 0 && prefix.trim() && (
        <p className="mt-4 text-[12px] text-ember">From must be ≤ To (max 200).</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!valid || saving}
          className="h-9 px-5 rounded-2 bg-saffron text-paper text-body-sm font-semibold disabled:opacity-40 transition-opacity duration-hover"
        >
          {saving ? 'Creating…' : `Create ${count} table${count !== 1 ? 's' : ''}`}
        </button>
        <button onClick={onClose} className="h-9 px-4 rounded-2 text-ink-6 hover:text-ink transition-colors duration-hover text-body-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add table card ─────────────────────────────────────────────────────────────

function AddTableCard({
  restaurantId,
  sortOrder,
  onCreated,
}: {
  restaurantId: string
  sortOrder: number
  onCreated: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [label, setLabel] = useState('')
  const [seats, setSeats] = useState(4)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!label.trim()) return
    setSaving(true)
    try {
      await supabase.from('tables').insert({ restaurant_id: restaurantId, label: label.trim(), seats, sort_order: sortOrder })
      await onCreated()
      setLabel('')
      setSeats(4)
      setExpanded(false)
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="bg-paper border border-dashed border-paper-4 rounded-3 p-4 flex flex-col items-center justify-center gap-2 text-ink-6 hover:text-ink hover:border-paper-3 transition-colors duration-hover min-h-[130px]"
      >
        <Plus size={18} />
        <span className="text-[12px]">Add table</span>
      </button>
    )
  }

  const inputCls = 'bg-paper border-[1.5px] border-paper-4 rounded-2 px-3 py-2 text-body text-ink placeholder:text-ink-7 outline-none focus:border-saffron transition-[border-color] duration-standard'

  return (
    <div className="bg-paper border border-paper-3 rounded-3 p-4 flex flex-col gap-2.5">
      <p className="text-overline text-ink-6 uppercase tracking-widest">New table</p>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        placeholder="Label (e.g. T 5)"
        autoFocus
        className={inputCls}
      />
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-ink-6 shrink-0">Seats</label>
        <input
          type="number"
          min="1"
          max="50"
          value={seats}
          onChange={e => setSeats(Number(e.target.value))}
          className="w-16 bg-paper border-[1.5px] border-paper-4 rounded-2 px-2 py-1.5 text-body text-ink font-mono outline-none focus:border-saffron transition-[border-color] duration-standard"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!label.trim() || saving}
          className="flex-1 h-9 rounded-2 bg-saffron text-paper text-body-sm font-semibold disabled:opacity-40 transition-opacity duration-hover"
        >
          Add
        </button>
        <button onClick={() => setExpanded(false)} className="px-3 h-9 rounded-2 text-ink-6 hover:text-ink transition-colors duration-hover text-body-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Table card ─────────────────────────────────────────────────────────────────

const STAGE_DOT: Record<string, string> = {
  received: 'bg-saffron',
  cooking:  'bg-honey',
  ready:    'bg-herb',
}

function TableCard({ table, onClick }: { table: TableWithStatus; onClick: () => void }) {
  const isMergedSecondary = !!table.status?.merged_into
  const isOccupied = !!table.status?.occupied_since || table.has_session_order
  const needsWaiter = table.has_pending_call

  let cardCls = 'bg-paper border border-paper-3 hover:bg-paper-2'
  if (needsWaiter) cardCls = 'bg-ember-wash border border-ember/40 hover:border-ember/60'
  else if (isMergedSecondary) cardCls = 'bg-paper border border-paper-3 opacity-60'
  else if (isOccupied) cardCls = 'bg-paper border border-saffron/30 hover:border-saffron/50'

  const statusLabel = needsWaiter ? 'waiter needed' : isMergedSecondary ? 'merged' : isOccupied ? 'occupied' : 'free'
  const statusColor = needsWaiter ? 'text-ember' : isOccupied && !isMergedSecondary ? 'text-saffron' : 'text-ink-5'

  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-3 p-4 flex flex-col gap-1.5 transition-colors duration-hover min-h-[130px] ${cardCls}`}
    >
      {needsWaiter && <BellRing size={13} className="absolute top-3 right-3 text-ember animate-pulse" />}

      <span className="font-mono text-[24px] font-bold text-ink leading-none">{table.label}</span>
      <span className="text-[11px] text-ink-6">{table.seats} seats</span>
      <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>{statusLabel}</span>

      {table.status?.waiter_name && (
        <span className="text-[12px] text-ink-6 truncate">{table.status.waiter_name}</span>
      )}

      {table.active_order_count > 0 && !isMergedSecondary && (
        <div className="flex items-center gap-1 mt-auto pt-1">
          {Object.entries(table.active_order_stages).flatMap(([stage, count]) =>
            Array.from({ length: count }).map((_, i) => (
              <span key={`${stage}-${i}`} className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[stage] ?? 'bg-paper-4'}`} />
            ))
          )}
        </div>
      )}

      {table.merged_secondary_labels.length > 0 && (
        <span className="text-[10px] text-ink-5 font-mono mt-auto pt-1">
          +{table.merged_secondary_labels.join(', ')}
        </span>
      )}
    </button>
  )
}

// ── Floor view ─────────────────────────────────────────────────────────────────

function FloorView({
  restaurantId,
  restaurantSlug,
}: {
  restaurantId: string
  restaurantSlug: string
}) {
  const { tables, loading, refetch } = useTables(restaurantId)
  const { calls, acknowledgeCall, acknowledgeAllForTable } = useWaiterCalls(restaurantId)

  const handleAckCall = useCallback(
    async (id: string) => { await acknowledgeCall(id); await refetch() },
    [acknowledgeCall, refetch]
  )

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const selectedTable = selectedTableId ? (tables.find(t => t.id === selectedTableId) ?? null) : null
  const [bulkOpen, setBulkOpen] = useState(false)

  const nextSortOrder = tables.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1

  const selectedCalls = selectedTable
    ? calls.filter(c =>
        c.table_label === selectedTable.label ||
        selectedTable.merged_secondary_labels.includes(c.table_label)
      )
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Waiter calls strip */}
      {calls.length > 0 && (
        <div className="flex items-center gap-3 bg-ember-wash border border-ember/30 rounded-3 px-4 py-3 mb-5 flex-wrap gap-y-2">
          <BellRing size={15} className="text-ember shrink-0 animate-pulse" />
          <span className="text-body-sm text-ember font-medium flex-1 min-w-0">
            {calls.length} waiter call{calls.length > 1 ? 's' : ''} pending
          </span>
          <div className="flex flex-wrap gap-1.5">
            {calls.map(call => (
              <button
                key={call.id}
                onClick={() => handleAckCall(call.id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-ember text-paper rounded-pill text-[11px] font-semibold hover:opacity-90 transition-opacity duration-hover"
              >
                {call.table_label} · Ack
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk create panel */}
      {bulkOpen && (
        <BulkCreatePanel
          restaurantId={restaurantId}
          sortOrderBase={nextSortOrder}
          onClose={() => setBulkOpen(false)}
          onCreated={refetch}
        />
      )}

      {/* Table grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
        {tables.map(table => (
          <TableCard key={table.id} table={table} onClick={() => setSelectedTableId(table.id)} />
        ))}

        <AddTableCard restaurantId={restaurantId} sortOrder={nextSortOrder} onCreated={refetch} />

        {!bulkOpen && (
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-paper border border-dashed border-paper-4 rounded-3 p-4 flex flex-col items-center justify-center gap-2 text-ink-6 hover:text-ink hover:border-paper-3 transition-colors duration-hover min-h-[130px]"
          >
            <span className="text-[18px] leading-none font-light text-ink-5">+10</span>
            <span className="text-[12px]">Bulk create</span>
          </button>
        )}
      </div>

      {tables.length === 0 && !bulkOpen && (
        <p className="text-center text-body-sm text-ink-6 mt-10">
          No tables yet. Add your first table above.
        </p>
      )}

      <TableDrawer
        table={selectedTable}
        allTables={tables}
        restaurantId={restaurantId}
        restaurantSlug={restaurantSlug}
        calls={selectedCalls}
        onAckCall={handleAckCall}
        onAckCallsForTable={acknowledgeAllForTable}
        onClose={() => setSelectedTableId(null)}
        onMutated={refetch}
      />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface TablesPageProps {
  restaurant: AdminRestaurant
}

export function TablesPage({ restaurant }: TablesPageProps) {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[28px] sm:text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
          Tables
        </h1>
        <div className="text-body-sm text-ink-6 mt-0.5">
          Manage your floor, assign waiters, and track occupancy.
        </div>
      </div>

      <FloorView restaurantId={restaurant.id} restaurantSlug={restaurant.slug} />
    </>
  )
}
