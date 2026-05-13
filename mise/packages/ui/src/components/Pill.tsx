import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

// Five order-lifecycle states + neutral
const pillVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5',
    'font-sans text-label font-medium whitespace-nowrap',
  ],
  {
    variants: {
      status: {
        received:  'bg-saffron-wash text-saffron',
        cooking:   'bg-honey-wash text-honey-2',
        ready:     'bg-herb-wash text-herb-2',
        picked_up: 'bg-paper-2 text-ink-5',
        cancelled: 'bg-ember-wash text-ember-2',
        neutral:   'bg-paper-2 text-ink-5',
      },
    },
    defaultVariants: {
      status: 'neutral',
    },
  }
)

export type OrderStage = 'received' | 'cooking' | 'ready' | 'picked_up' | 'cancelled'

const LABELS: Record<OrderStage | 'neutral', string> = {
  received:  'Received',
  cooking:   'Cooking',
  ready:     'Ready',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
  neutral:   '',
}

export interface PillProps extends VariantProps<typeof pillVariants> {
  status: OrderStage | 'neutral'
  label?: string
  children?: React.ReactNode
  className?: string
}

export function Pill({ className, status, label, children }: PillProps) {
  return (
    <span
      className={cn(pillVariants({ status }), className)}
    >
      {children ?? label ?? LABELS[status]}
    </span>
  )
}
