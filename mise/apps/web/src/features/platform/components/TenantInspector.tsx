import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'
import { useQueryClient } from '@tanstack/react-query'
import { usePlatformCurrency } from '../hooks/usePlatformCurrency'
import type { FleetTenant } from '../hooks/useFleet'


function fmtRevenue(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
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
  const { currency: platformCurrency } = usePlatformCurrency()
  const open = tenant !== null

  // Local copy so changes reflect immediately without waiting for a refetch
  const [suspended, setSuspended] = useState(tenant?.suspended ?? false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  // 'suspend' | 'resume' | null — waiting for inline confirmation
  const [confirming, setConfirming] = useState<'suspend' | 'resume' | null>(null)

  // Edit details
  const [editName, setEditName] = useState(tenant?.name ?? '')
  const [editTagline, setEditTagline] = useState(tenant?.tagline ?? '')
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  // Sync local state when tenant prop changes (e.g. new tenant opened)
  useEffect(() => {
    if (tenant) {
      setSuspended(tenant.suspended)
      setActionError('')
      setConfirming(null)
      setEditName(tenant.name)
      setEditTagline(tenant.tagline ?? '')
      setDetailsError('')
      setDetailsSaved(false)
    }
  }, [tenant?.id])

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

  async function saveDetails() {
    if (!tenant) return
    const trimmedName = editName.trim()
    if (!trimmedName) { setDetailsError('Name cannot be empty.'); return }
    setDetailsSaving(true)
    setDetailsError('')

    const { error } = await supabase
      .from('restaurants')
      .update({ name: trimmedName, tagline: editTagline.trim() || null })
      .eq('id', tenant.id)

    if (error) {
      setDetailsError(error.message || 'Update failed — check your permissions.')
      setDetailsSaving(false)
      return
    }

    await qc.invalidateQueries({ queryKey: ['fleet'] })
    setDetailsSaving(false)
    setDetailsSaved(true)
    setTimeout(() => setDetailsSaved(false), 2000)
  }

  async function setSuspendedState(value: boolean) {
    if (!tenant) return
    setBusy(true)
    setActionError('')
    setConfirming(null)

    const { error } = await supabase
      .from('restaurants')
      .update({ suspended: value })
      .eq('id', tenant.id)

    if (error) {
      setActionError(error.message || 'Update failed — check your permissions.')
      setBusy(false)
      return
    }

    setSuspended(value)
    await qc.invalidateQueries({ queryKey: ['fleet'] })
    setBusy(false)
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
        className={`fixed top-0 right-0 h-full w-full sm:w-[540px] z-50 bg-paper overflow-y-auto shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {tenant && (
          <div className="p-5 md:p-7">
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

            {/* Status banner when suspended */}
            {suspended && (
              <div className="px-3 py-2.5 bg-ember-wash text-ember rounded-2 text-body-sm mb-4">
                <strong className="font-semibold">Suspended</strong> — this restaurant has been locked by platform admin.
              </div>
            )}

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
                { k: 'Revenue', v: fmtRevenue(tenant.revenueTodayCents, platformCurrency) },
                { k: 'Last seen', v: fmtLastSeen(tenant.lastSeenAt) },
                { k: 'Errors (24h)', v: String(tenant.errors) },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between py-1.5 text-body-sm">
                  <span className="text-ink-6">{k}</span>
                  <span className="font-mono tabular-nums text-ink">{v}</span>
                </div>
              ))}
            </div>

            {/* Edit details */}
            <div className="py-3.5 border-b border-paper-3">
              <h3 className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Edit details</h3>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[11px] text-ink-6 font-medium uppercase tracking-wide mb-1 block">Name</label>
                  <input
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setDetailsError('') }}
                    className="w-full px-3 py-2 border-[1.5px] border-paper-4 rounded-2 text-body-sm text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-ink-6 font-medium uppercase tracking-wide mb-1 block">Tagline</label>
                  <input
                    value={editTagline}
                    onChange={e => { setEditTagline(e.target.value); setDetailsError('') }}
                    placeholder="e.g. Modern Provençal · Mile End"
                    className="w-full px-3 py-2 border-[1.5px] border-paper-4 rounded-2 text-body-sm text-ink bg-paper placeholder:text-ink-7 focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
                  />
                </div>
                {detailsError && <p className="text-body-sm text-ember">{detailsError}</p>}
                <button
                  onClick={saveDetails}
                  disabled={detailsSaving}
                  className="w-fit px-3.5 py-2 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover disabled:opacity-50"
                >
                  {detailsSaved ? 'Saved!' : detailsSaving ? 'Saving…' : 'Save details'}
                </button>
              </div>
            </div>

            {/* Open in */}
            <div className="py-3.5 border-b border-paper-3">
              <h3 className="text-overline text-ink-6 uppercase tracking-widest mb-2.5">Open in</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Guest menu',  sub: `r/${tenant.slug}`, href: `/r/${tenant.slug}` },
                  { label: 'Kitchen',     sub: 'display board',    href: `/kitchen/${tenant.id}` },
                  { label: 'Owner admin', sub: 'view as owner',    href: `/admin/enter?as=${tenant.id}` },
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
              <div className="flex flex-wrap gap-2.5">
                {/* Suspend / Unsuspend */}
                {!suspended ? (
                  confirming === 'suspend' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm text-ink-5">Suspend {tenant.name}?</span>
                      <button
                        onClick={() => setSuspendedState(true)}
                        disabled={busy}
                        className="px-3 py-2 rounded-2 bg-ember text-paper text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {busy ? 'Suspending…' : 'Yes, suspend'}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        disabled={busy}
                        className="px-3 py-2 rounded-2 border border-paper-4 text-body-sm text-ink font-semibold hover:bg-paper-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming('suspend')}
                      disabled={busy}
                      className="px-3.5 py-2.5 rounded-2 border-[1.5px] border-ember-wash text-ember bg-paper text-body-sm font-semibold hover:bg-ember-wash transition-colors duration-hover disabled:opacity-40"
                    >
                      Suspend tenant
                    </button>
                  )
                ) : (
                  confirming === 'resume' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm text-ink-5">Unsuspend {tenant.name}?</span>
                      <button
                        onClick={() => setSuspendedState(false)}
                        disabled={busy}
                        className="px-3 py-2 rounded-2 bg-herb text-paper text-body-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {busy ? 'Unsuspending…' : 'Yes, unsuspend'}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        disabled={busy}
                        className="px-3 py-2 rounded-2 border border-paper-4 text-body-sm text-ink font-semibold hover:bg-paper-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming('resume')}
                      disabled={busy}
                      className="px-3.5 py-2.5 rounded-2 border-[1.5px] border-herb bg-paper text-herb text-body-sm font-semibold hover:bg-herb-wash transition-colors duration-hover disabled:opacity-40"
                    >
                      Unsuspend tenant
                    </button>
                  )
                )}
              </div>

              {actionError && (
                <p className="text-body-sm text-ember mt-3">{actionError}</p>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  )
}
