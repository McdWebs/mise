import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { KpiTile } from '../components/KpiTile'
import { Sk } from '../components/Skeleton'
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
  const since = useMemo(startOfToday, [])
  const queryClient = useQueryClient()
  const key = ['admin-conversations', restaurant.id]

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('id, created_at, messages_jsonb')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Conversation[]
    },
    staleTime: 0,
  })

  // Realtime: invalidate whenever a conversation is inserted or updated
  useEffect(() => {
    const ch = supabase
      .channel(`assistant-conversations-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assistant_conversations', filter: `restaurant_id=eq.${restaurant.id}` },
        () => queryClient.invalidateQueries({ queryKey: key })
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurant.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = conversations.length

  if (isLoading) return <AssistantSkeleton />

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

function AssistantSkeleton() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Sk className="h-8 w-36" />
        <Sk className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <Sk className="h-3 w-28" />
            <Sk className="h-9 w-12" />
            <Sk className="h-3 w-16" />
            <div className="flex items-end gap-0.5 h-6 mt-1">
              {Array.from({ length: 12 }).map((_, j) => (
                <Sk key={j} className="flex-1 rounded-[2px]" style={{ height: `${20 + Math.random() * 80}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <Sk className="h-6 w-44 mb-2" />
        <Sk className="h-4 w-96 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-paper-3 last:border-0">
              <Sk className="h-4 flex-1" />
              <Sk className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
