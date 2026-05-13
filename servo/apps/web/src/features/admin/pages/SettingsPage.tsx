import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { OrderingToggle } from '@/features/kitchen/components/OrderingToggle'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'
import { useSession } from '@/features/auth/hooks/useSession'

const CURRENCIES = [
  { code: 'USD', label: 'USD – US Dollar ($)'           },
  { code: 'EUR', label: 'EUR – Euro (€)'                },
  { code: 'GBP', label: 'GBP – British Pound (£)'       },
  { code: 'CAD', label: 'CAD – Canadian Dollar ($)'     },
  { code: 'AUD', label: 'AUD – Australian Dollar ($)'   },
  { code: 'NZD', label: 'NZD – New Zealand Dollar ($)'  },
  { code: 'SGD', label: 'SGD – Singapore Dollar (S$)'   },
  { code: 'HKD', label: 'HKD – Hong Kong Dollar (HK$)'  },
  { code: 'ILS', label: 'ILS – Israeli Shekel (₪)'      },
  { code: 'JPY', label: 'JPY – Japanese Yen (¥)'        },
  { code: 'CHF', label: 'CHF – Swiss Franc (Fr.)'       },
  { code: 'NOK', label: 'NOK – Norwegian Krone (kr)'    },
  { code: 'SEK', label: 'SEK – Swedish Krona (kr)'      },
  { code: 'DKK', label: 'DKK – Danish Krone (kr)'       },
  { code: 'MXN', label: 'MXN – Mexican Peso ($)'        },
  { code: 'BRL', label: 'BRL – Brazilian Real (R$)'     },
  { code: 'INR', label: 'INR – Indian Rupee (₹)'        },
  { code: 'ZAR', label: 'ZAR – South African Rand (R)'  },
  { code: 'AED', label: 'AED – UAE Dirham (د.إ)'        },
  { code: 'THB', label: 'THB – Thai Baht (฿)'           },
]

interface SettingsPageProps {
  restaurant: AdminRestaurant
}

const inputClass =
  'w-full max-w-[360px] px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard'

function SettingRow({
  label,
  description,
  children,
  compact = false,
  alignStart = false,
}: {
  label: string
  description: string
  children: React.ReactNode
  compact?: boolean
  alignStart?: boolean
}) {
  return (
    <div
      className={`grid border-b border-paper-3 last:border-b-0 ${
        alignStart ? 'items-start' : 'items-center'
      } ${compact ? 'gap-4 py-2.5' : 'gap-6 py-4'}`}
      style={{ gridTemplateColumns: '240px 1fr' }}
    >
      <div className="min-w-0">
        <div className={`font-semibold text-ink ${compact ? 'text-body-sm' : 'text-body'}`}>{label}</div>
        <div
          className={`text-ink-6 mt-0.5 ${compact ? 'text-[11px] leading-snug' : 'text-body-sm'}`}
        >
          {description}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function SettingsPage({ restaurant }: SettingsPageProps) {
  const { user } = useSession()
  const qc = useQueryClient()
  const [name, setName] = useState(restaurant.name)
  const [tagline, setTagline] = useState(restaurant.tagline ?? '')
  const [currency, setCurrency] = useState(restaurant.currency)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutAwaitingConfirm, setSignOutAwaitingConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const guestUrl = `${window.location.origin}/r/${restaurant.slug}`

  async function performSignOut() {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setSigningOut(false)
      setSignOutAwaitingConfirm(false)
    }
  }

  async function save() {
    setSaving(true)
    await supabase.from('restaurants').update({
      name: name.trim(),
      tagline: tagline.trim() || null,
      currency: currency.trim(),
    }).eq('id', restaurant.id)
    await qc.invalidateQueries({ queryKey: ['admin-restaurant'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(guestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function updatePassword() {
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters.')
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordError(error.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSuccess(true)
    setTimeout(() => setPasswordSuccess(false), 4000)
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Venue settings
          </h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            Information guests see, plus operational toggles.
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2.5 rounded-2 bg-saffron text-paper text-body font-semibold hover:bg-saffron-2 transition-colors duration-hover disabled:opacity-50 active:scale-[0.98] active:duration-press"
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-4">
          Public
        </h2>

        <SettingRow label="Restaurant name" description="Shown on the guest menu header.">
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
        </SettingRow>

        <SettingRow label="Tagline" description="One line, under the name.">
          <input
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="e.g. Modern Provençal · Mile End"
            className={`${inputClass} placeholder:text-ink-6`}
          />
        </SettingRow>

        <SettingRow label="Public link & QR" description="Stable URL guests scan or visit.">
          <div className="flex items-center gap-4 p-4 bg-paper-2 rounded-3 max-w-[460px]">
            <QRCodeSVG value={guestUrl} size={64} className="shrink-0 rounded-1" />
            <div className="min-w-0">
              <div className="font-mono text-[13px] text-ink truncate">{guestUrl}</div>
              <div className="text-body-sm text-ink-6 mt-0.5">
                Share, print, or download PDF for table tents
              </div>
            </div>
            <button
              onClick={copyLink}
              className="ml-auto shrink-0 px-3 py-2 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </SettingRow>

        <SettingRow label="Currency" description="Symbol shown on every price across your menu and guest receipt.">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-[260px] px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard appearance-none cursor-pointer"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Ordering" description="Pause to stop accepting new orders without taking the menu down.">
          <OrderingToggle restaurantId={restaurant.id} accepting={restaurant.accepting_orders} />
        </SettingRow>
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-5 mt-6">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-4">
          Account
        </h2>
        <SettingRow compact label="Signed in as" description="The email on your Servo admin account.">
          <div className="text-body-sm text-ink truncate max-w-[360px] leading-snug">{user?.email ?? '—'}</div>
        </SettingRow>
        <SettingRow
          compact
          alignStart={passwordOpen}
          label="Password"
          description="Sign in with email and password? Set a new one here. (Other sign-in methods may not apply.)"
        >
          <div className="flex max-w-[360px] flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setPasswordOpen(open => {
                  if (open) {
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordError(null)
                    setPasswordSuccess(false)
                  }
                  return !open
                })
              }}
              aria-expanded={passwordOpen}
              aria-controls="account-password-panel"
              id="account-password-toggle"
              className="inline-flex w-fit items-center gap-1.5 px-3 py-2 rounded-2 border-[1.5px] border-paper-4 text-body-sm font-semibold text-ink hover:bg-paper-2 transition-colors duration-hover"
            >
              {passwordOpen ? 'Hide' : 'Change password'}
              <ChevronDown
                size={16}
                className={`shrink-0 text-ink-5 transition-transform duration-standard ${passwordOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {passwordOpen && (
              <div id="account-password-panel" role="region" aria-labelledby="account-password-toggle" className="flex flex-col gap-2 pt-1">
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value)
                    setPasswordError(null)
                  }}
                  autoComplete="new-password"
                  placeholder="New password"
                  className={inputClass}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    setPasswordError(null)
                  }}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  className={inputClass}
                />
                {passwordError && (
                  <p className="text-body-sm text-red-600" role="alert">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-body-sm text-ink-5">Password updated.</p>
                )}
                <button
                  type="button"
                  onClick={updatePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="mt-1 w-fit px-3 py-2 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover disabled:opacity-50"
                >
                  {passwordSaving ? 'Updating…' : 'Update password'}
                </button>
              </div>
            )}
          </div>
        </SettingRow>
        <SettingRow compact label="Sign out" description="End your session on this device.">
          {!signOutAwaitingConfirm ? (
            <button
              type="button"
              onClick={() => setSignOutAwaitingConfirm(true)}
              disabled={signingOut}
              aria-expanded={false}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2 border-[1.5px] border-paper-4 text-body-sm font-semibold text-ink hover:bg-paper-2 hover:border-paper-4 transition-colors duration-hover disabled:opacity-50"
            >
              <LogOut size={14} />
              Sign out
            </button>
          ) : (
            <div
              role="group"
              aria-label="Confirm sign out"
              className="flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              <span className="text-body-sm text-ink whitespace-nowrap">Are you sure?</span>
              <button
                type="button"
                onClick={() => setSignOutAwaitingConfirm(false)}
                disabled={signingOut}
                className="px-3 py-2 rounded-2 border-[1.5px] border-paper-4 text-body-sm font-semibold text-ink hover:bg-paper-2 transition-colors duration-hover disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={performSignOut}
                disabled={signingOut}
                className="px-3 py-2 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover disabled:opacity-50"
              >
                {signingOut ? 'Signing out…' : 'Yes'}
              </button>
            </div>
          )}
        </SettingRow>
      </div>
    </>
  )
}
