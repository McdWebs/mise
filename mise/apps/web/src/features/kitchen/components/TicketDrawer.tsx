import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { KitchenOrder } from '../hooks/useKitchenOrders'
import type { OrderStage } from '@mise/types'

const NEXT_STAGE: Partial<Record<OrderStage, OrderStage>> = {
  received: 'cooking',
  cooking:  'ready',
  ready:    'picked_up',
}

const ADVANCE_LABEL: Partial<Record<OrderStage, string>> = {
  received: 'Start cooking',
  cooking:  'Mark ready',
  ready:    'Mark picked up',
}

const STAGE_LABEL: Partial<Record<OrderStage, string>> = {
  received:  'Received',
  cooking:   'Cooking',
  ready:     'Ready',
  picked_up: 'Picked up',
}

const STAGE_CLS: Partial<Record<OrderStage, string>> = {
  received:  'bg-honey/15 text-honey-2',
  cooking:   'bg-saffron/15 text-saffron-3',
  ready:     'bg-herb/15 text-herb-2',
  picked_up: 'bg-paper-3 text-ink-5',
}

function fmtElapsed(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)} hr ago`
}

function parsePlanLine(line: string): { name: string; mods: string[] } {
  const parts = line.split(' · ')
  return { name: parts[0], mods: parts.slice(1) }
}

interface TicketDrawerProps {
  order: KitchenOrder | null
  onClose: () => void
  applyOrderStage: (orderId: string, stage: OrderStage) => void
  applyOrderUrgent: (orderId: string, urgent: boolean) => void
  restoreKitchenOrder: (order: KitchenOrder) => void
}

export function TicketDrawer({ order, onClose, applyOrderStage, applyOrderUrgent, restoreKitchenOrder }: TicketDrawerProps) {
  const [saving, setSaving] = useState(false)
  const [, setTick] = useState(0)
  const open = order !== null

  // Refresh elapsed time display every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function advance() {
    if (!order) return
    const next = NEXT_STAGE[order.stage as OrderStage]
    if (!next) return
    const prevStage = order.stage as OrderStage
    setSaving(true)
    applyOrderStage(order.id, next)
    const { error } = await supabase.from('orders').update({ stage: next }).eq('id', order.id)
    setSaving(false)
    if (error) { applyOrderStage(order.id, prevStage); return }
    onClose()
  }

  async function cancel() {
    if (!order) return
    const snapshot = { ...order }
    setSaving(true)
    applyOrderStage(order.id, 'cancelled')
    const { error } = await supabase.from('orders').update({ stage: 'cancelled' }).eq('id', order.id)
    setSaving(false)
    if (error) { restoreKitchenOrder(snapshot); return }
    onClose()
  }

  async function toggleUrgent() {
    if (!order) return
    const next = !order.urgent
    applyOrderUrgent(order.id, next)
    const { error } = await supabase.from('orders').update({ urgent: next }).eq('id', order.id)
    if (error) applyOrderUrgent(order.id, !next)
  }

  const nextLabel   = order ? ADVANCE_LABEL[order.stage as OrderStage] : null
  const stageLabel  = order ? (STAGE_LABEL[order.stage as OrderStage] ?? order.stage) : ''
  const stageCls    = order ? (STAGE_CLS[order.stage as OrderStage] ?? '') : ''
  const subtotalFmt = order ? `$${(order.subtotal_cents / 100).toFixed(2)}` : ''
  const isActive    = order?.stage !== 'cancelled' && order?.stage !== 'picked_up'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/60 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[340px] z-50 bg-paper flex flex-col shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b border-paper-3 ${order?.urgent ? 'bg-ember-wash' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Table label + urgent badge */}
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-[22px] font-bold text-ink uppercase tracking-tight leading-none">
                  {order?.table_label ?? '—'}
                </span>
                {order?.urgent && (
                  <span className="text-[9px] font-bold tracking-[0.1em] text-ember uppercase bg-ember/10 px-1.5 py-0.5 rounded leading-none">
                    Urgent
                  </span>
                )}
              </div>
              {/* Stage + ID + elapsed */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${stageCls}`}>
                  {stageLabel}
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-ink-7 shrink-0" />
                <span className="font-mono text-[11px] text-ink-5 tracking-widest">
                  #{order?.id.slice(-4).toUpperCase()}
                </span>
                <span className="w-0.5 h-0.5 rounded-full bg-ink-7 shrink-0" />
                <span className="text-[11px] text-ink-6">
                  {order ? fmtElapsed(order.created_at) : ''}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-2 text-ink-6 hover:text-ink hover:bg-paper-2 transition-colors duration-hover"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Order items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="divide-y divide-paper-3">
            {order?.order_items.map(item => {
              const plan  = Boolean(item.restaurant_plan_id)
              const title = item.restaurant_plans?.title ?? item.menu_items?.name ?? '—'
              const detailLines =
                item.modifiers?.length
                  ? item.modifiers
                  : (plan && item.restaurant_plans?.includes?.length
                    ? item.restaurant_plans.includes
                    : [])

              return (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    {/* Qty badge */}
                    <span className="shrink-0 mt-0.5 min-w-[28px] h-[20px] px-1.5 rounded bg-paper-3 flex items-center justify-center font-mono text-[11px] text-ink-6 font-semibold">
                      {item.quantity}×
                    </span>

                    <div className="min-w-0 flex-1">
                      {/* Name + plan badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-ink leading-snug">{title}</span>
                        {plan && (
                          <span className="text-[9px] font-mono font-bold text-saffron uppercase tracking-wider bg-saffron/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                            plan
                          </span>
                        )}
                      </div>

                      {/* Plan detail lines — each included item with customisations */}
                      {plan && detailLines.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {detailLines.map((line, i) => {
                            if (line.startsWith('Note:')) {
                              return (
                                <p key={i} className="text-[12px] text-ink-5 italic leading-snug pl-3.5">
                                  {line}
                                </p>
                              )
                            }
                            const { name, mods } = parsePlanLine(line)
                            return (
                              <div key={i} className="flex items-baseline gap-1.5">
                                <span className="text-saffron shrink-0 text-[11px] leading-none mt-[2px]">·</span>
                                <p className="text-[13px] text-ink leading-snug">
                                  {name}
                                  {mods.length > 0 && (
                                    <span className="text-ink-5"> · {mods.join(' · ')}</span>
                                  )}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Regular item modifiers */}
                      {!plan && detailLines.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {detailLines.map((mod, i) => (
                            <p key={i} className="text-[12px] text-ember leading-snug">{mod}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Total */}
        <div className="px-5 py-3.5 border-t border-paper-3 flex justify-between items-center">
          <span className="text-[13px] font-medium text-ink-5">Order total</span>
          <span className="font-mono text-[17px] font-bold text-ink tabular-nums">{subtotalFmt}</span>
        </div>

        {/* Actions */}
        <div className="px-5 pb-7 pt-3 space-y-2">
          {nextLabel && (
            <button
              onClick={advance}
              disabled={saving}
              className="w-full h-12 rounded-2 bg-ink text-paper text-[15px] font-semibold transition-opacity duration-hover disabled:opacity-50 active:scale-[0.98] active:duration-press"
            >
              {saving ? 'Saving…' : nextLabel}
            </button>
          )}
          {isActive && (
            <button
              onClick={toggleUrgent}
              disabled={saving}
              className={`w-full h-10 rounded-2 text-[14px] font-semibold transition-colors duration-hover disabled:opacity-50 active:scale-[0.98] active:duration-press ${
                order?.urgent
                  ? 'bg-ember-wash border border-ember/40 text-ember'
                  : 'bg-ember/10 border border-ember/20 text-ember hover:bg-ember/15'
              }`}
            >
              {order?.urgent ? 'Remove urgent flag' : 'Mark as urgent'}
            </button>
          )}
          {isActive && (
            <button
              onClick={cancel}
              disabled={saving}
              className="w-full h-10 text-ink-5 text-[14px] font-medium transition-colors duration-hover disabled:opacity-50 hover:text-ink"
            >
              Cancel order
            </button>
          )}
        </div>
      </div>
    </>
  )
}
