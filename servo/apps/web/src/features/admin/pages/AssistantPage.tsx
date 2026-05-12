import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KpiTile } from '../components/KpiTile'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

interface Conversation {
  id: string
  created_at: string
  messages_jsonb: unknown
}

interface AssistantPageProps {
  restaurant: AdminRestaurant
}

export function AssistantPage({ restaurant }: AssistantPageProps) {
  const since = startOfToday()

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['admin-conversations', restaurant.id, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('id, created_at, messages_jsonb')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
      if (error) throw error
      return (data ?? []) as Conversation[]
    },
    staleTime: 1000 * 60,
  })

  const total = conversations.length

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
          Assistant
        </h1>
        <div className="text-body-sm text-ink-6 mt-0.5">
          What guests asked the menu helper today — and what it answered.
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        <KpiTile
          label="Conversations"
          value={String(total)}
          delta={total > 0 ? 'today' : 'None yet'}
          spark={Array(12).fill(0).map((_, i) => (i === 11 ? total : 0))}
        />
        <KpiTile
          label="Helped without staff"
          value="—"
          delta="Live in phase 6"
          spark={Array(12).fill(0)}
        />
        <KpiTile
          label="Escalated to a person"
          value="—"
          delta="Live in phase 6"
          spark={Array(12).fill(0)}
        />
      </div>

      {/* Top questions */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
          Top questions today
        </h2>
        <p className="text-body-sm text-ink-6 mb-4">
          Tap a question to see the full answer the assistant gave, grounded in your menu.
        </p>

        {total === 0 ? (
          <div className="py-6 text-center">
            <p className="text-body-sm text-ink-6">
              Top questions will appear here once the assistant is live.
            </p>
            <p className="text-body-sm text-ink-7 mt-1">The AI assistant is wired up in phase 6.</p>
          </div>
        ) : (
          <p className="text-body-sm text-ink-6">
            {total} conversation{total !== 1 ? 's' : ''} today. Full question analytics arrive in phase 6.
          </p>
        )}
      </div>
    </>
  )
}
