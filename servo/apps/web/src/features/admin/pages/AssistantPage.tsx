import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KpiTile } from '../components/KpiTile'
import { Sk } from '../components/Skeleton'
import { AssistantMessageContent } from '@/features/guest/components/AssistantMessageContent'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

interface ConvMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  created_at: string
  messages_jsonb: ConvMessage[]
}

interface AssistantPageProps {
  restaurant: AdminRestaurant
}

const ESCALATION_PHRASES = [
  "let your server know",
  "server is happy to help",
  "team is happy to help",
  "ask your server",
  "a member of the team",
  "couldn't reach the assistant",
]

function isEscalated(messages: ConvMessage[]): boolean {
  return messages.some(
    m => m.role === 'assistant' && ESCALATION_PHRASES.some(p => m.content.toLowerCase().includes(p))
  )
}

interface TopQuestion {
  text: string
  count: number
  answer: string
}

export function AssistantPage({ restaurant }: AssistantPageProps) {
  const since = useMemo(startOfToday, [])
  const queryClient = useQueryClient()
  const key = ['admin-conversations', restaurant.id]
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

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
  const escalatedCount = useMemo(
    () => conversations.filter(c => isEscalated(c.messages_jsonb)).length,
    [conversations]
  )
  const helpedCount = total - escalatedCount

  const topQuestions = useMemo<TopQuestion[]>(() => {
    const map = new Map<string, { count: number; answer: string }>()
    for (const conv of conversations) {
      const msgs = conv.messages_jsonb
      const q = msgs.find(m => m.role === 'user')?.content?.trim()
      if (!q) continue
      const key = q.toLowerCase()
      const answer = msgs.find((m, i) => i > 0 && m.role === 'assistant')?.content ?? ''
      if (!map.has(key)) map.set(key, { count: 0, answer })
      map.get(key)!.count++
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([text, { count, answer }]) => ({ text, count, answer }))
  }, [conversations])

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
          value={total > 0 ? String(helpedCount) : '—'}
          delta={total > 0 ? `${Math.round((helpedCount / total) * 100)}% of today` : 'No data yet'}
          spark={Array(12).fill(0).map((_, i) => (i === 11 ? helpedCount : 0))}
        />
        <KpiTile
          label="Escalated to a person"
          value={total > 0 ? String(escalatedCount) : '—'}
          delta={total > 0 ? `${Math.round((escalatedCount / total) * 100)}% of today` : 'No data yet'}
          spark={Array(12).fill(0).map((_, i) => (i === 11 ? escalatedCount : 0))}
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
          <div className="py-8 text-center">
            <p className="text-body-sm text-ink-6">
              Questions will appear here once guests start using the assistant.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-paper-3">
            {topQuestions.map(q => {
              const isOpen = expandedQ === q.text
              return (
                <div key={q.text}>
                  <button
                    onClick={() => setExpandedQ(isOpen ? null : q.text)}
                    className="w-full flex items-center gap-3 py-3 text-left group"
                  >
                    <span className="flex-1 text-[14px] text-ink group-hover:text-ink-2 transition-colors line-clamp-2">
                      {q.text}
                    </span>
                    <span className="text-[12px] text-ink-6 shrink-0 tabular-nums">
                      {q.count}×
                    </span>
                    {isOpen
                      ? <ChevronUp size={14} className="text-ink-6 shrink-0" />
                      : <ChevronDown size={14} className="text-ink-6 shrink-0" />
                    }
                  </button>

                  {isOpen && q.answer && (
                    <div className="pb-3 pl-0 pr-6">
                      <div className="bg-paper-2 rounded-[12px_12px_12px_4px] px-3.5 py-2.5 text-[13px] leading-[1.55] text-ink">
                        <AssistantMessageContent text={q.answer} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
            <div key={i} className="flex items-center gap-3 py-3 border-b border-paper-3 last:border-0">
              <Sk className="h-4 flex-1" />
              <Sk className="h-4 w-6" />
              <Sk className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
