import { useState, useCallback } from 'react'
import { Plus, BellRing, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTables } from '../hooks/useTables'
import { TableCard } from './TableCard'
import { TableDrawer } from './TableDrawer'
import type { WaiterCall } from '../hooks/useWaiterCalls'

interface TableFloorProps {
  restaurantId: string
  restaurantSlug: string
  calls: WaiterCall[]
  onAckCall: (id: string) => Promise<void>
}

function generateLabels(prefix: string, from: number, to: number): string[] {
  if (from > to || to - from > 199) return []
  return Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`)
}

function previewText(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length <= 5) return labels.join(', ')
  return `${labels.slice(0, 3).join(', ')} … ${labels[labels.length - 1]}`
}

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

  const fieldCls = 'bg-ink-3 border border-ink-3 rounded-2 px-3 py-2 text-paper font-mono outline-none focus:border-saffron/60 transition-[border-color] duration-standard'

  return (
    <div className="bg-ink-2 border border-ink-3 rounded-3 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold text-ink-6 uppercase tracking-widest">Bulk create tables</p>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-1 text-ink-6 hover:text-paper transition-colors duration-hover"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6">Prefix</label>
          <input
            value={prefix}
            onChange={e => setPrefix(e.target.value)}
            placeholder="T "
            className={`${fieldCls} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6">From</label>
          <input
            type="number"
            min="1"
            value={from}
            onChange={e => setFrom(Math.max(1, Number(e.target.value)))}
            className={`${fieldCls} w-20`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6">To</label>
          <input
            type="number"
            min="1"
            value={to}
            onChange={e => setTo(Math.max(1, Number(e.target.value)))}
            className={`${fieldCls} w-20`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-ink-6">Seats each</label>
          <input
            type="number"
            min="1"
            max="50"
            value={seats}
            onChange={e => setSeats(Math.max(1, Number(e.target.value)))}
            className={`${fieldCls} w-20`}
          />
        </div>
      </div>

      {/* Preview */}
      {count > 0 && (
        <p className="mt-4 text-[12px] text-ink-6 font-mono">
          <span className="text-ink-5">{count} tables: </span>
          {previewText(labels)}
        </p>
      )}
      {count === 0 && prefix.trim() && (
        <p className="mt-4 text-[12px] text-ember">From must be less than or equal to To (max 200).</p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!valid || saving}
          className="h-9 px-5 rounded-2 bg-saffron text-paper text-body-sm font-semibold disabled:opacity-40 transition-opacity duration-hover"
        >
          {saving ? 'Creating…' : `Create ${count} table${count !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={onClose}
          className="h-9 px-4 rounded-2 text-ink-6 hover:text-paper transition-colors duration-hover text-body-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

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
      await supabase.from('tables').insert({
        restaurant_id: restaurantId,
        label: label.trim(),
        seats,
        sort_order: sortOrder,
      })
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
        className="bg-ink-2 border border-dashed border-ink-3 rounded-3 p-4 flex flex-col items-center justify-center gap-2 text-ink-5 hover:text-ink-7 hover:border-ink-5 transition-colors duration-hover min-h-[130px]"
      >
        <Plus size={18} />
        <span className="text-[12px]">Add table</span>
      </button>
    )
  }

  return (
    <div className="bg-ink-2 border border-ink-3 rounded-3 p-4 flex flex-col gap-2.5">
      <p className="text-[10px] font-semibold text-ink-6 uppercase tracking-widest">New table</p>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        placeholder="Label (e.g. T 5)"
        autoFocus
        className="bg-ink-3 border border-ink-3 rounded-2 px-3 py-2 text-paper text-body placeholder:text-ink-6 outline-none focus:border-saffron/60 transition-[border-color] duration-standard"
      />
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-ink-6 shrink-0">Seats</label>
        <input
          type="number"
          min="1"
          max="50"
          value={seats}
          onChange={e => setSeats(Number(e.target.value))}
          className="w-16 bg-ink-3 border border-ink-3 rounded-2 px-2 py-1.5 text-paper text-body font-mono outline-none focus:border-saffron/60 transition-[border-color] duration-standard"
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
        <button
          onClick={() => setExpanded(false)}
          className="px-3 h-9 rounded-2 text-ink-6 hover:text-paper transition-colors duration-hover text-body-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function TableFloor({ restaurantId, restaurantSlug, calls, onAckCall }: TableFloorProps) {
  const { tables, loading, refetch } = useTables(restaurantId)
  const handleAckCall = useCallback(
    async (id: string) => {
      await onAckCall(id)
      await refetch()
    },
    [onAckCall, refetch]
  )
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const selectedTable = selectedTableId
    ? (tables.find(t => t.id === selectedTableId) ?? null)
    : null
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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-ink-3 border-t-saffron rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Pending waiter calls strip */}
      {calls.length > 0 && (
        <div className="flex items-center gap-3 bg-ember/10 border border-ember/30 rounded-3 px-4 py-3 mb-5 flex-wrap gap-y-2">
          <BellRing size={15} className="text-ember shrink-0 animate-pulse" />
          <span className="text-body-sm text-ember font-medium flex-1 min-w-0">
            {calls.length} waiter call{calls.length > 1 ? 's' : ''} pending
          </span>
          <div className="flex flex-wrap gap-1.5">
            {calls.map(call => (
              <button
                key={call.id}
                onClick={() => handleAckCall(call.id)}
                className="flex items-center gap-1 px-2.5 py-1 bg-ember/20 border border-ember/40 text-ember rounded-pill text-[11px] font-semibold hover:bg-ember hover:text-paper transition-colors duration-hover"
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
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}
      >
        {tables.map(table => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => setSelectedTableId(table.id)}
          />
        ))}

        <AddTableCard restaurantId={restaurantId} sortOrder={nextSortOrder} onCreated={refetch} />

        {/* Bulk create trigger card */}
        {!bulkOpen && (
          <button
            onClick={() => setBulkOpen(true)}
            className="bg-ink-2 border border-dashed border-ink-3 rounded-3 p-4 flex flex-col items-center justify-center gap-2 text-ink-5 hover:text-ink-7 hover:border-ink-5 transition-colors duration-hover min-h-[130px]"
          >
            <span className="text-[18px] leading-none font-light text-ink-5">+10</span>
            <span className="text-[12px]">Bulk create</span>
          </button>
        )}
      </div>

      {tables.length === 0 && !bulkOpen && (
        <p className="text-center text-body-sm text-ink-5 mt-10">
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
        onClose={() => setSelectedTableId(null)}
        onMutated={refetch}
      />
    </div>
  )
}
