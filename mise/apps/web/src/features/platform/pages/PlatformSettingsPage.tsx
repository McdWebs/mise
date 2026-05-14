import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'
import { usePlatformCurrency } from '../hooks/usePlatformCurrency'

const CURRENCIES = [
  { code: 'ILS', label: 'ILS – Israeli Shekel (₪)'      },
  { code: 'USD', label: 'USD – US Dollar ($)'            },
  { code: 'EUR', label: 'EUR – Euro (€)'                 },
  { code: 'GBP', label: 'GBP – British Pound (£)'        },
  { code: 'CAD', label: 'CAD – Canadian Dollar ($)'      },
  { code: 'AUD', label: 'AUD – Australian Dollar ($)'    },
  { code: 'SGD', label: 'SGD – Singapore Dollar (S$)'    },
  { code: 'JPY', label: 'JPY – Japanese Yen (¥)'         },
  { code: 'CHF', label: 'CHF – Swiss Franc (Fr.)'        },
  { code: 'AED', label: 'AED – UAE Dirham (د.إ)'         },
]

interface PlatformAdmin {
  id: string
  email: string
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initials(email: string) {
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

const inputClass =
  'w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard'

export function PlatformSettingsPage({ user }: { user: User }) {
  // ── Platform currency ────────────────────────────────────────────────────
  const { currency, setCurrency } = usePlatformCurrency()

  // ── Change password ──────────────────────────────────────────────────────
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')

  async function savePassword() {
    setPwError('')
    setPwSuccess('')
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess('Password updated.')
      setNewPw('')
      setConfirmPw('')
    }
    setPwSaving(false)
  }

  // ── Platform admins list ─────────────────────────────────────────────────
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('users')
      .select('id, email, created_at')
      .eq('role', 'super_admin')
      .order('created_at')
      .then(({ data }) => {
        setAdmins((data ?? []) as PlatformAdmin[])
        setAdminsLoading(false)
      })
  }, [])


  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">Settings</h1>
        <p className="text-body-sm text-ink-6 mt-0.5">Manage your account and platform configuration.</p>
      </div>

      {/* Profile card */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-5 flex items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-ink flex items-center justify-center shrink-0">
          <span className="font-display text-[18px] font-[500] text-paper font-optical">
            {initials(user.email ?? '')}
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[15px] text-ink truncate">{user.email}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-saffron-wash text-ink">
              Platform admin
            </span>
            <span className="text-body-sm text-ink-6">·</span>
            <span className="text-body-sm text-ink-6">Joined {fmtDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Platform currency */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-5">
        <h2 className="text-overline text-ink-6 uppercase tracking-widest mb-1">Display currency</h2>
        <p className="text-body-sm text-ink-6 mb-4">
          All revenue figures in the fleet table and analytics are shown in this currency.
          Exchange rates are fetched live and used to convert amounts.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="appearance-none w-full sm:w-[300px] px-3 py-2.5 pr-9 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard cursor-pointer"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-6" />
          </div>
          <span className="text-body-sm text-ink-6">
            Currently showing all amounts in <span className="font-semibold text-ink">{currency}</span>
          </span>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Change password */}
        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <h2 className="text-overline text-ink-6 uppercase tracking-widest mb-4">Change password</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-body-sm text-ink-6 mb-1.5">New password</label>
              <input
                type="password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwError(''); setPwSuccess('') }}
                placeholder="Min. 8 characters"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-body-sm text-ink-6 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwError(''); setPwSuccess('') }}
                placeholder="Repeat new password"
                className={inputClass}
              />
            </div>
            {pwError && <p className="text-body-sm text-ember">{pwError}</p>}
            {pwSuccess && <p className="text-body-sm text-herb">{pwSuccess}</p>}
            <button
              onClick={savePassword}
              disabled={pwSaving || !newPw || !confirmPw}
              className="w-full px-4 py-2.5 rounded-2 bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover disabled:opacity-40"
            >
              {pwSaving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </div>

        {/* Platform admins */}
        <div className="bg-paper border border-paper-3 rounded-3 p-5">
          <h2 className="text-overline text-ink-6 uppercase tracking-widest mb-4">Platform admins</h2>
          {adminsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
            </div>
          ) : admins.length === 0 ? (
            <p className="text-body-sm text-ink-6 py-4">No admins found.</p>
          ) : (
            <div className="space-y-0">
              {admins.map(admin => (
                <div
                  key={admin.id}
                  className="flex items-center gap-3 py-3 border-b border-paper-3 last:border-b-0"
                >
                  <div className="w-8 h-8 rounded-full bg-paper-3 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-ink-5">
                      {initials(admin.email)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm text-ink font-mono truncate">{admin.email}</div>
                    <div className="text-[11px] text-ink-6 mt-0.5">Joined {fmtDate(admin.created_at)}</div>
                  </div>
                  {admin.id === user.id && (
                    <span className="shrink-0 text-[11px] font-semibold text-ink-6 bg-paper-2 px-2 py-0.5 rounded-pill">
                      you
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
