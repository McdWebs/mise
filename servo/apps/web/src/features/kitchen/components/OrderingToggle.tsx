import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface OrderingToggleProps {
  restaurantId: string
  accepting: boolean
}

export function OrderingToggle({ restaurantId, accepting }: OrderingToggleProps) {
  const [optimistic, setOptimistic] = useState(accepting)
  const [saving, setSaving] = useState(false)

  // Sync prop → local when it changes from realtime
  if (accepting !== optimistic && !saving) setOptimistic(accepting)

  async function toggle() {
    const next = !optimistic
    setOptimistic(next)
    setSaving(true)
    await supabase
      .from('restaurants')
      .update({ accepting_orders: next })
      .eq('id', restaurantId)
    setSaving(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink-2 border border-ink-3 rounded-pill text-[13px] font-medium cursor-pointer transition-opacity duration-hover disabled:opacity-60"
      aria-label={optimistic ? 'Accepting orders — click to pause' : 'Paused — click to resume'}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: optimistic ? 'var(--herb)' : 'var(--ember)' }}
      />
      <span style={{ color: optimistic ? 'var(--paper)' : 'var(--ember)' }}>
        {optimistic ? 'Accepting orders' : 'Paused'}
      </span>
    </button>
  )
}
