import type { RestaurantPlan } from '../hooks/usePlans'
import { formatPrice } from '../utils/formatPrice'

function parseMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function isActiveNow(plan: RestaurantPlan): boolean {
  const { start_time, end_time } = plan
  if (!start_time && !end_time) return true
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const start = start_time ? parseMinutes(start_time) : 0
  const end = end_time ? parseMinutes(end_time) : 24 * 60
  // Handle overnight wrap (e.g. 22:00 – 02:00)
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function timeLabel(plan: RestaurantPlan): string | null {
  if (plan.start_time && plan.end_time) return `${fmtTime(plan.start_time)} – ${fmtTime(plan.end_time)}`
  if (plan.start_time) return `from ${fmtTime(plan.start_time)}`
  if (plan.end_time) return `until ${fmtTime(plan.end_time)}`
  return null
}

interface PlansSectionProps {
  plans: RestaurantPlan[]
  currency: string
  onAddPlan?: (plan: RestaurantPlan) => void
}

export function PlansSection({ plans, currency, onAddPlan }: PlansSectionProps) {
  const active = plans.filter(isActiveNow)
  if (active.length === 0) return null

  return (
    <div className="px-5 pt-5 pb-3">
      <p className="text-overline text-ink-6 uppercase tracking-[0.08em] mb-3">Plans</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-5 px-5">
        {active.map(plan => {
          const window = timeLabel(plan)
          return (
            <div
              key={plan.id}
              className="flex-shrink-0 w-[260px] bg-ink rounded-3 p-4 flex flex-col"
            >
              {/* Badge + price row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-saffron uppercase tracking-[0.1em] bg-saffron/10 px-2 py-0.5 rounded-pill">
                    Plan
                  </span>
                  {window && (
                    <span className="text-[10px] font-mono text-ink-6 bg-ink-2 px-2 py-0.5 rounded-pill">
                      {window}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[18px] font-semibold text-paper tabular-nums">
                  {formatPrice(plan.price_cents, currency)}
                  <span className="text-[12px] text-ink-6 font-normal ml-1">/ pp</span>
                </span>
              </div>

              {/* Title */}
              <h3 className="font-display text-[20px] font-[500] text-paper leading-tight tracking-[-0.01em] font-optical mb-1">
                {plan.title}
              </h3>

              {/* Description */}
              {plan.description && (
                <p className="text-[13px] text-ink-6 leading-[1.4] mb-3">{plan.description}</p>
              )}

              {/* Includes */}
              {plan.includes.length > 0 && (
                <ul className="mt-auto space-y-1.5 pt-3 border-t border-ink-2">
                  {plan.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-ink-7">
                      <span className="text-saffron mt-px leading-none">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {onAddPlan && (
                <button
                  type="button"
                  onClick={() => onAddPlan(plan)}
                  className="mt-3 w-full h-10 rounded-2 bg-saffron text-paper text-[13px] font-semibold transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press"
                >
                  Add plan to order
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
