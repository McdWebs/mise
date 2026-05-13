import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Check, Copy, Loader } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'
import { useQueryClient } from '@tanstack/react-query'

// Secondary client with no session persistence — signUp won't replace the super admin's session
const signupClient = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP', 'AED', 'JPY'] as const

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Props {
  open: boolean
  onClose: () => void
}

interface SuccessData {
  ownerEmail: string
  slug: string
}

export function CreateRestaurantModal({ open, onClose }: Props) {
  const qc = useQueryClient()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [tagline, setTagline] = useState('')
  const [currency, setCurrency] = useState<string>('ILS')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [emailCheck, setEmailCheck] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle')
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name))
  }, [name, slugEdited])

  useEffect(() => {
    if (open) {
      setSuccess(null)
      setTimeout(() => nameRef.current?.focus(), 60)
    } else {
      setName('')
      setSlug('')
      setSlugEdited(false)
      setTagline('')
      setCurrency('ILS')
      setOwnerEmail('')
      setOwnerPassword('')
      setEmailCheck('idle')
      setSaving(false)
      setError(null)
      setSuccess(null)
      setCopied(false)
    }
  }, [open])

  const checkEmail = useCallback((email: string) => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current)
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailCheck('idle')
      return
    }
    setEmailCheck('checking')
    emailCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('email', trimmed).maybeSingle()
      setEmailCheck(data ? 'taken' : 'available')
    }, 400)
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !ownerEmail.trim() || !ownerPassword) return
    setSaving(true)
    setError(null)

    // Step 1 — create restaurant (super_admin RLS allows this)
    const { data: restaurant, error: rErr } = await supabase
      .from('restaurants')
      .insert({ name: name.trim(), slug: slug.trim(), tagline: tagline.trim() || null, currency, accepting_orders: true })
      .select('id')
      .single()

    if (rErr) {
      setError(rErr.code === '23505' ? 'A restaurant with this slug already exists.' : rErr.message)
      setSaving(false)
      return
    }

    const restaurantId = (restaurant as { id: string }).id

    // Step 2 — sign up owner with a non-persistent client so the super admin's session is untouched.
    // The DB trigger `on_auth_user_created` auto-creates the public.users row.
    const { data: signUpData, error: signUpErr } = await signupClient.auth.signUp({
      email: ownerEmail.trim(),
      password: ownerPassword,
    })

    if (signUpErr || !signUpData.user) {
      await supabase.from('restaurants').delete().eq('id', restaurantId)
      setError(signUpErr?.message ?? 'Failed to create owner account.')
      setSaving(false)
      return
    }

    // Step 3 — link owner to restaurant (super_admin RLS allows this)
    const { error: mErr } = await supabase
      .from('restaurant_members')
      .insert({ user_id: signUpData.user.id, restaurant_id: restaurantId, role: 'owner' })

    if (mErr) {
      await supabase.from('restaurants').delete().eq('id', restaurantId)
      setError(mErr.message)
      setSaving(false)
      return
    }

    await qc.invalidateQueries({ queryKey: ['fleet'] })
    setSaving(false)
    setSuccess({ ownerEmail: ownerEmail.trim(), slug: slug.trim() })
  }

  function copyPassword() {
    navigator.clipboard.writeText(ownerPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const loginUrl = `${window.location.origin}/login`
  const canSubmit =
    name.trim().length > 0 &&
    slug.trim().length > 0 &&
    ownerEmail.trim().length > 0 &&
    ownerPassword.length >= 8 &&
    emailCheck !== 'taken' &&
    emailCheck !== 'checking' &&
    !saving

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/45 transition-opacity duration-standard ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[480px] z-50 bg-paper overflow-y-auto shadow-2 transition-transform duration-standard ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-7">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-display text-[26px] font-[500] text-ink tracking-[-0.01em] leading-tight font-optical">
                {success ? 'Restaurant created' : 'New restaurant'}
              </h2>
              <p className="text-body-sm text-ink-6 mt-1">
                {success ? 'The owner can now sign in.' : 'Creates a new tenant and owner account.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-ink-6 hover:text-ink transition-colors duration-hover mt-1"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-herb-wash rounded-2 flex items-start gap-3">
                <Check size={18} className="text-herb mt-0.5 shrink-0" />
                <div>
                  <p className="text-body-sm font-semibold text-ink">{name}</p>
                  <p className="text-[12px] text-ink-6 font-mono mt-0.5">/r/{success.slug}</p>
                </div>
              </div>

              <div className="border border-paper-3 rounded-2 divide-y divide-paper-3">
                <div className="px-4 py-3">
                  <p className="text-overline text-ink-6 uppercase tracking-widest mb-1">Owner email</p>
                  <p className="text-body-sm font-mono text-ink">{success.ownerEmail}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-overline text-ink-6 uppercase tracking-widest mb-1">Temporary password</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-body-sm font-mono text-ink tracking-wider">{'•'.repeat(ownerPassword.length)}</p>
                    <button
                      onClick={copyPassword}
                      className="flex items-center gap-1.5 text-[12px] text-ink-6 hover:text-ink transition-colors duration-hover"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-overline text-ink-6 uppercase tracking-widest mb-1">Login URL</p>
                  <p className="text-body-sm font-mono text-ink break-all">{loginUrl}</p>
                </div>
              </div>

              <p className="text-[12px] text-ink-6 leading-relaxed">
                Share the email, temporary password, and login URL with the owner. They should change their password after first sign-in.
              </p>

              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover"
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Create form ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Restaurant details */}
              <p className="text-overline text-ink-6 uppercase tracking-widest -mb-1">Restaurant</p>

              <label className="flex flex-col gap-1.5">
                <span className="text-body-sm font-medium text-ink-5">Name *</span>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. The Golden Fork"
                  required
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper placeholder:text-ink-7 outline-none focus:border-ink transition-colors duration-hover"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-body-sm font-medium text-ink-5">Slug *</span>
                <div className="flex items-center border-[1.5px] border-paper-4 rounded-2 focus-within:border-ink transition-colors duration-hover overflow-hidden">
                  <span className="px-3 py-2.5 bg-paper-2 text-ink-6 text-body-sm shrink-0 border-r border-paper-4">
                    /r/
                  </span>
                  <input
                    value={slug}
                    onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugEdited(true) }}
                    placeholder="the-golden-fork"
                    required
                    className="flex-1 min-w-0 px-3 py-2.5 text-body text-ink bg-paper placeholder:text-ink-7 outline-none"
                  />
                </div>
              </label>

              <div className="flex gap-3">
                <label className="flex flex-col gap-1.5 flex-1">
                  <span className="text-body-sm font-medium text-ink-5">Tagline</span>
                  <input
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="Optional subtitle"
                    className="w-full px-3.5 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper placeholder:text-ink-7 outline-none focus:border-ink transition-colors duration-hover"
                  />
                </label>

                <label className="flex flex-col gap-1.5 w-[110px] shrink-0">
                  <span className="text-body-sm font-medium text-ink-5">Currency</span>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper outline-none focus:border-ink transition-colors duration-hover appearance-none"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Owner account */}
              <div className="border-t border-paper-3 pt-4 mt-1">
                <p className="text-overline text-ink-6 uppercase tracking-widest mb-3">Owner account</p>

                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-body-sm font-medium text-ink-5">Email *</span>
                    <div className="relative">
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={e => { setOwnerEmail(e.target.value); checkEmail(e.target.value) }}
                        placeholder="owner@restaurant.com"
                        required
                        autoComplete="off"
                        className={`w-full px-3.5 py-2.5 pr-10 border-[1.5px] rounded-2 text-body text-ink bg-paper placeholder:text-ink-7 outline-none transition-colors duration-hover ${
                          emailCheck === 'taken' ? 'border-ember focus:border-ember' :
                          emailCheck === 'available' ? 'border-herb focus:border-herb' :
                          'border-paper-4 focus:border-ink'
                        }`}
                      />
                      {emailCheck === 'checking' && (
                        <Loader size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-6 animate-spin" />
                      )}
                      {emailCheck === 'available' && (
                        <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-herb" />
                      )}
                    </div>
                    {emailCheck === 'taken' && (
                      <p className="text-[12px] text-ember">This email is already registered. Use a different address.</p>
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-body-sm font-medium text-ink-5">Temporary password *</span>
                    <input
                      type="text"
                      value={ownerPassword}
                      onChange={e => setOwnerPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      autoComplete="off"
                      className="w-full px-3.5 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper placeholder:text-ink-7 outline-none focus:border-ink transition-colors duration-hover font-mono"
                    />
                    <p className="text-[12px] text-ink-6">Share this with the owner — they should change it after first sign-in.</p>
                  </label>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-3.5 py-2.5 bg-ember-wash text-ember-2 rounded-2 text-body-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="px-5 py-2.5 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating…' : 'Create restaurant'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-2 border-[1.5px] border-paper-4 text-ink text-body-sm font-semibold hover:bg-paper-2 transition-colors duration-hover"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
