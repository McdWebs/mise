import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface OrderingToggleProps {
  restaurantId: string
  accepting: boolean
}

export function OrderingToggle({ restaurantId, accepting }: OrderingToggleProps) {
  const [optimistic, setOptimistic] = useState(accepting)
  const [saving, setSaving] = useState(false)

  // Only when the parent / realtime pushes a new value — not while parent cache is stale
  // after a local toggle (that was resetting "Paused" back to accepting).
  useEffect(() => {
    setOptimistic(accepting)
  }, [accepting])

  async function toggle() {
    const next = !optimistic
    const previous = optimistic
    setOptimistic(next)
    setSaving(true)
    const { error } = await supabase
      .from('restaurants')
      .update({ accepting_orders: next })
      .eq('id', restaurantId)
    setSaving(false)
    if (error) setOptimistic(previous)
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={[
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-pill text-label font-medium cursor-pointer',
        'border transition-[border-color,background-color,transform,opacity] duration-hover',
        'active:scale-[0.98] active:duration-press disabled:opacity-60 disabled:active:scale-100',
        optimistic
          ? 'bg-herb-wash border-herb/30 text-herb-2 hover:border-herb/50'
          : 'bg-ember-wash border-ember/30 text-ember hover:border-ember/50',
      ].join(' ')}
      aria-label={optimistic ? 'Accepting orders — click to pause' : 'Paused — click to resume'}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 shadow-[inset_0_0_0_1px_rgba(26,22,18,0.08)] ${optimistic ? 'bg-herb' : 'bg-ember'}`}
        aria-hidden
      />
      <span>{optimistic ? 'Accepting orders' : 'Paused'}</span>
    </button>
  )
}
