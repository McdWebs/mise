import { BellRing } from 'lucide-react'
import type { TableWithStatus } from '../hooks/useTables'

const STAGE_DOT: Record<string, string> = {
  received: 'bg-saffron',
  cooking:  'bg-honey',
  ready:    'bg-herb',
}

interface TableCardProps {
  table: TableWithStatus
  onClick: () => void
}

export function TableCard({ table, onClick }: TableCardProps) {
  const isMergedSecondary = !!table.status?.merged_into
  const hasGuestSession = !!table.status?.occupied_since || table.has_session_order
  const hasKitchenOrders = table.active_order_count > 0
  const isOccupied = hasGuestSession
  const needsWaiter = table.has_pending_call

  let borderClass = 'border-ink-3 hover:border-ink-5'
  if (needsWaiter) borderClass = 'border-ember/50 hover:border-ember'
  else if (isMergedSecondary) borderClass = 'border-ink-3 opacity-60'
  else if (isOccupied) borderClass = 'border-saffron/30 hover:border-saffron/60'

  const statusLabel = needsWaiter
    ? 'waiter needed'
    : isMergedSecondary
    ? 'merged'
    : isOccupied
    ? 'occupied'
    : 'free'

  const statusColor = needsWaiter
    ? 'text-ember'
    : isOccupied && !isMergedSecondary
    ? 'text-saffron'
    : 'text-ink-5'

  return (
    <button
      onClick={onClick}
      className={`relative text-left bg-ink-2 border rounded-3 p-4 flex flex-col gap-1.5 transition-colors duration-hover min-h-[130px] ${borderClass}`}
    >
      {needsWaiter && (
        <BellRing size={13} className="absolute top-3 right-3 text-ember animate-pulse" />
      )}

      <span className="font-mono text-[26px] font-bold text-paper leading-none">
        {table.label}
      </span>

      <span className="text-[11px] text-ink-6">{table.seats} seats</span>

      <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>
        {statusLabel}
      </span>

      {table.status?.waiter_name && (
        <span className="text-[12px] text-ink-7 truncate">{table.status.waiter_name}</span>
      )}

      {hasKitchenOrders && !isMergedSecondary && (
        <div className="flex items-center gap-1 mt-auto pt-1">
          {Object.entries(table.active_order_stages).flatMap(([stage, count]) =>
            Array.from({ length: count }).map((_, i) => (
              <span
                key={`${stage}-${i}`}
                className={`w-1.5 h-1.5 rounded-full ${STAGE_DOT[stage] ?? 'bg-ink-5'}`}
              />
            ))
          )}
        </div>
      )}

      {table.merged_secondary_labels.length > 0 && (
        <span className="text-[10px] text-ink-5 font-mono mt-auto pt-1">
          +{table.merged_secondary_labels.join(', ')}
        </span>
      )}
    </button>
  )
}
