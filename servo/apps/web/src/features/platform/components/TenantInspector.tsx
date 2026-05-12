import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import type { FleetTenant } from '../hooks/useFleet'

function fmtRevenue(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtLastSeen(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

interface TenantInspectorProps {
  tenant: FleetTenant | null
  onClose: () => void
}

export function TenantInspector({ tenant, onClose }: TenantInspectorProps) {
  const qc = useQueryClient()
  const [suspending, setSuspending] = useState(false)
  const open = tenant !== null

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function suspendTenant() {
    if (!tenant) return
    const ok = window.confirm(`Suspend ${tenant.name}? This will stop accepting new orders.`)
    if (!ok) return
    setSuspending(true)
    await supabase.from('restaurants').update({ accepting_orders: false }).eq('id', tenant.id)
    await qc.invalidateQueries({ queryKey: ['fleet'] })
    setSuspending(false)
    onClose()
  }

  const origin = window.location.origin

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/45 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[540px] z-50 bg-paper overflow-y-auto shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {tenant && (
          <div className="p-7">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-[26px] font-[500] text-ink tracking-[-0.01em] leading-tight font-optical">
                  {tenant.name}
                </h2>
                <p className="font-mono text-[12px] text-ink-6 mt-1">
                  {origin}/r/{tenant.slug}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-ink-6 hover:text-ink text-[22px] leading-none transition-colors duration-hover mt-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Issue banner */}
            {tenant.issue && (
              <div className="px-3 py-2.5 bg-ember-wash text-ember-2 rounded-2 text-body-sm mb-4">
                <strong className="font-semibold">Issue · </strong>{tenant.issue}
              </div>
            )}

            {/* Today stats */}
            <div className="py-3.5 border-b border-paper-3">
              <h3 className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Today</h3>
              {[
                { k: 'Orders', v: String(tenant.ordersToday) },
                { k: 'Revenue', v: fmtRevenue(tenant.revenueTodayCents) },
                { k: 'Last seen', v: fmtLastSeen(tenant.lastSeenAt) },
                { k: 'Errors (24h)', v: String(tenant.errors) },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between py-1.5 text-body-sm">
                  <span className="text-ink-6">{k}</span>
                  <span className="font-mono tabular-nums text-ink">{v}</span>
                </div>
              ))}
            </div>

            {/* Open in */}
            <div className="py-3.5 border-b border-paper-3">
              <h3 className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Open in</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Guest menu',   sub: `r/${tenant.slug}`,  href: `/r/${tenant.slug}` },
                  { label: 'Kitchen',      sub: 'display board',     href: `/kitchen` },
                  { label: 'Owner admin',  sub: 'impersonate',       href: `/admin` },
                ].map(({ label, sub, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-paper-2 rounded-2 text-body-sm font-semibold text-ink text-center hover:bg-paper-3 transition-colors duration-hover no-underline"
                  >
                    {label}
                    <small className="block text-[11px] font-normal text-ink-6 mt-0.5">{sub}</small>
                  </a>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="py-3.5">
              <h3 className="text-overline text-ink-6 uppercase tracking-widest mb-3">Actions</h3>
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    // Stub — Phase 8+ would trigger a re-publish job
                    alert('Re-publish triggered (stub — wire to deployment pipeline in phase 8).')
                  }}
                  className="px-3.5 py-2.5 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover"
                >
                  Force re-publish menu
                </button>
                <button
                  onClick={suspendTenant}
                  disabled={suspending || !tenant.accepting_orders}
                  className="px-3.5 py-2.5 rounded-2 border-[1.5px] border-ember-wash text-ember bg-paper text-body-sm font-semibold hover:bg-ember-wash transition-colors duration-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {tenant.accepting_orders ? 'Suspend tenant' : 'Already paused'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
