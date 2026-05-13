import type { OrderStage } from '@mise/types'

const CONFIG: Record<OrderStage, { bg: string; text: string; dot: string; label: string }> = {
  received:  { bg: 'bg-saffron-wash', text: 'text-saffron-3', dot: 'bg-saffron',  label: 'Received'  },
  cooking:   { bg: 'bg-honey-wash',   text: 'text-honey-2',   dot: 'bg-honey-2',   label: 'Cooking'   },
  ready:     { bg: 'bg-herb-wash',    text: 'text-herb-2',    dot: 'bg-herb-2',    label: 'Ready'     },
  picked_up: { bg: 'bg-paper-2',      text: 'text-ink-5',     dot: 'bg-ink-7',     label: 'Picked up' },
  cancelled: { bg: 'bg-ember-wash',   text: 'text-ember-2',   dot: 'bg-ember',     label: 'Cancelled' },
}

export function StagePill({ stage }: { stage: OrderStage }) {
  const c = CONFIG[stage] ?? CONFIG.picked_up
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[12px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
