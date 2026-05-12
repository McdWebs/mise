import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { OrderingToggle } from '@/features/kitchen/components/OrderingToggle'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

interface SettingsPageProps {
  restaurant: AdminRestaurant
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid gap-6 py-4 border-b border-paper-3 items-center last:border-b-0"
      style={{ gridTemplateColumns: '240px 1fr' }}
    >
      <div>
        <div className="text-body font-semibold text-ink">{label}</div>
        <div className="text-body-sm text-ink-6 mt-0.5">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  )
}

export function SettingsPage({ restaurant }: SettingsPageProps) {
  const qc = useQueryClient()
  const [name, setName] = useState(restaurant.name)
  const [tagline, setTagline] = useState(restaurant.tagline ?? '')
  const [currency, setCurrency] = useState(restaurant.currency)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const guestUrl = `${window.location.origin}/r/${restaurant.slug}`

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
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full max-w-[360px] px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
          />
        </SettingRow>

        <SettingRow label="Tagline" description="One line, under the name.">
          <input
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="e.g. Modern Provençal · Mile End"
            className="w-full max-w-[360px] px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper placeholder:text-ink-6 focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
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

        <SettingRow label="Currency" description="All prices on your menu use this.">
          <input
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-[160px] px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard"
          />
        </SettingRow>

        <SettingRow label="Ordering" description="Pause to stop accepting new orders without taking the menu down.">
          <OrderingToggle restaurantId={restaurant.id} accepting={restaurant.accepting_orders} />
        </SettingRow>
      </div>
    </>
  )
}
