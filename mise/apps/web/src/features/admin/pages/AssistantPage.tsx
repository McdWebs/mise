import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KpiTile } from '../components/KpiTile'
import { DatePicker } from '../components/DatePicker'
import { Sk } from '../components/Skeleton'
import { AssistantMessageContent } from '@/features/guest/components/AssistantMessageContent'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

type Range = 'today' | '7d' | '30d' | 'custom'

const RANGE_LABELS: Record<Range, string> = {
  today:  'Today',
  '7d':   '7 days',
  '30d':  '30 days',
  custom: 'Custom',
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function presetSince(range: Exclude<Range, 'custom'>): string {
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
  } else if (range === '7d') {
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

function hourlyBuckets(convs: { created_at: string }[], n = 12): number[] {
  const now = Date.now()
  const buckets = Array<number>(n).fill(0)
  convs.forEach(c => {
    const diffH = Math.floor((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60))
    if (diffH < n) buckets[n - 1 - diffH]++
  })
  return buckets
}

function dailyBuckets(convs: { created_at: string }[], n: number): number[] {
  const now = new Date()
  const buckets = Array<number>(n).fill(0)
  convs.forEach(c => {
    const dayAgo = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (dayAgo < n) buckets[n - 1 - dayAgo]++
  })
  return buckets
}

function customBuckets(convs: { created_at: string }[], fromISO: string, n: number): number[] {
  const from = new Date(fromISO).getTime()
  const buckets = Array<number>(n).fill(0)
  convs.forEach(c => {
    const dayIdx = Math.floor((new Date(c.created_at).getTime() - from) / (1000 * 60 * 60 * 24))
    if (dayIdx >= 0 && dayIdx < n) buckets[dayIdx]++
  })
  return buckets
}

function presetDayLabels(n: number): string[] {
  const labels: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(n <= 7
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : String(d.getDate()))
  }
  return labels
}

function customDayLabels(fromISO: string, n: number): string[] {
  const from = new Date(fromISO)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    return n <= 14
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(d.getDate())
  })
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
  'let your server know',
  'server is happy to help',
  'team is happy to help',
  'ask your server',
  'a member of the team',
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

function ActivityChart({ buckets, labels, n }: { buckets: number[]; labels: string[]; n: number }) {
  const max = Math.max(...buckets, 1)
  const showEvery = n <= 7 ? 1 : 5
  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {buckets.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div
              className={`rounded-[2px] w-full transition-all ${i === buckets.length - 1 ? 'bg-saffron' : 'bg-paper-3'}`}
              style={{ height: `${Math.max(2, Math.round((v / max) * 60))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 mt-1">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            {(i % showEvery === 0 || i === labels.length - 1) && (
              <span className={`text-[10px] tabular-nums ${i === labels.length - 1 ? 'text-saffron font-semibold' : 'text-ink-6'}`}>
                {label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AssistantPage({ restaurant }: AssistantPageProps) {
  const queryClient = useQueryClient()
  const [range, setRange]           = useState<Range>('today')
  const [customFrom, setCustomFrom] = useState(() => todayISO())
  const [customTo, setCustomTo]     = useState(() => todayISO())
  const [appliedFrom, setAppliedFrom] = useState(customFrom)
  const [appliedTo, setAppliedTo]     = useState(customTo)
  const [expandedQ, setExpandedQ]   = useState<string | null>(null)
  const [instructions, setInstructions] = useState(restaurant.assistant_instructions ?? '')
  const [instrSaving, setInstrSaving]   = useState(false)
  const [instrSaved, setInstrSaved]     = useState(false)

  const since = useMemo(() => {
    if (range === 'custom') return `${appliedFrom}T00:00:00.000Z`
    return presetSince(range as Exclude<Range, 'custom'>)
  }, [range, appliedFrom])

  const until = useMemo(() => {
    if (range === 'custom') return `${appliedTo}T23:59:59.999Z`
    return undefined
  }, [range, appliedTo])

  const queryKey = ['admin-conversations', restaurant.id, range, since, until ?? 'now']

  async function saveInstructions() {
    setInstrSaving(true)
    await supabase
      .from('restaurants')
      .update({ assistant_instructions: instructions.trim() || null })
      .eq('id', restaurant.id)
    await queryClient.invalidateQueries({ queryKey: ['admin-restaurant'] })
    setInstrSaving(false)
    setInstrSaved(true)
    setTimeout(() => setInstrSaved(false), 2000)
  }

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('assistant_conversations')
        .select('id, created_at, messages_jsonb')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (until) query = query.lte('created_at', until)
      const { data, error } = await query
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
        () => queryClient.invalidateQueries({ queryKey: ['admin-conversations', restaurant.id] })
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

  const { spark, labels, bucketCount } = useMemo(() => {
    if (range === 'today') {
      return { spark: hourlyBuckets(conversations), labels: [] as string[], bucketCount: 12 }
    }
    if (range === 'custom') {
      const from = new Date(appliedFrom).getTime()
      const to   = new Date(appliedTo).getTime()
      const n    = Math.min(Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1), 90)
      return {
        spark:       customBuckets(conversations, appliedFrom, n),
        labels:      customDayLabels(appliedFrom, n),
        bucketCount: n,
      }
    }
    const n = range === '7d' ? 7 : 30
    return {
      spark:       dailyBuckets(conversations, n),
      labels:      presetDayLabels(n),
      bucketCount: n,
    }
  }, [conversations, range, appliedFrom, appliedTo])

  const topQuestions = useMemo<TopQuestion[]>(() => {
    const map = new Map<string, { count: number; answer: string }>()
    for (const conv of conversations) {
      const msgs = conv.messages_jsonb
      const q = msgs.find(m => m.role === 'user')?.content?.trim()
      if (!q) continue
      const k = q.toLowerCase()
      const answer = msgs.find((m, i) => i > 0 && m.role === 'assistant')?.content ?? ''
      if (!map.has(k)) map.set(k, { count: 0, answer })
      map.get(k)!.count++
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([text, { count, answer }]) => ({ text, count, answer }))
  }, [conversations])

  // Lowercase, used inside sentences ("questions asked last 7 days")
  const periodLabel = useMemo(() => {
    if (range === 'today')  return 'today'
    if (range === '7d')     return 'last 7 days'
    if (range === '30d')    return 'last 30 days'
    if (appliedFrom === appliedTo)
      return new Date(appliedFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${new Date(appliedFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(appliedTo + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [range, appliedFrom, appliedTo])

  // Title-case, used in the page subtitle
  const subtitleLabel = useMemo(() => {
    if (range === 'today')
      return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (range === '7d')  return 'Last 7 days'
    if (range === '30d') return 'Last 30 days'
    if (appliedFrom === appliedTo)
      return new Date(appliedFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    return `${new Date(appliedFrom + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(appliedTo + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [range, appliedFrom, appliedTo])

  const days = range === 'today' ? 1 : bucketCount
  const avgPerDay = days > 1 ? (total / days).toFixed(1) : null
  const showChart = range !== 'today' && bucketCount > 1

  if (isLoading) return <AssistantSkeleton />

  return (
    <>
      {/* Header */}
      <div className="mb-6 min-w-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] sm:text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
              Assistant
            </h1>
            <div className="text-body-sm text-ink-6 mt-0.5 break-words">
              {subtitleLabel} · {total} conversation{total !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1 overflow-x-auto rounded-2 bg-paper-2 p-1 sm:flex-nowrap">
              {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setExpandedQ(null) }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors duration-hover ${
                    range === r ? 'bg-paper text-ink shadow-1' : 'text-ink-5 hover:text-ink'
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom date pickers — separate row, same as OrdersPage */}
        {range === 'custom' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <DatePicker
              value={customFrom}
              max={customTo}
              onChange={v => setCustomFrom(v)}
              placeholder="From"
            />
            <span className="text-body-sm text-ink-6 hidden sm:inline">to</span>
            <DatePicker
              value={customTo}
              min={customFrom}
              max={todayISO()}
              onChange={v => setCustomTo(v)}
              placeholder="To"
            />
            <button
              type="button"
              onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo); setExpandedQ(null) }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-2 bg-saffron text-paper text-body-sm font-semibold hover:bg-saffron-2 transition-colors duration-hover"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiTile
          label="Conversations"
          value={String(total)}
          delta={total > 0 ? subtitleLabel : 'None yet'}
          spark={spark}
        />
        <KpiTile
          label="Self-served"
          value={total > 0 ? String(helpedCount) : '—'}
          delta={total > 0 ? `${Math.round((helpedCount / total) * 100)}% of total` : 'No data yet'}
          spark={spark}
        />
        <KpiTile
          label="Escalated"
          value={total > 0 ? String(escalatedCount) : '—'}
          delta={total > 0 ? `${Math.round((escalatedCount / total) * 100)}% of total` : 'No data yet'}
          deltaDown={escalatedCount > 0}
          spark={spark}
        />
        <KpiTile
          label={range === 'today' ? 'Active hours' : 'Avg per day'}
          value={
            total === 0
              ? '—'
              : avgPerDay !== null
              ? avgPerDay
              : String(spark.filter(v => v > 0).length)
          }
          delta={range === 'today' ? 'hours with activity' : 'conversations / day'}
          spark={spark}
        />
      </div>

      {/* Activity chart */}
      {showChart && (
        <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-6">
          <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
            Activity
          </h2>
          <p className="text-body-sm text-ink-6 mb-4">
            Conversations per day for {periodLabel}.
          </p>
          {total === 0 ? (
            <p className="text-body-sm text-ink-6 py-4">No conversations in this period.</p>
          ) : (
            <ActivityChart buckets={spark} labels={labels} n={bucketCount} />
          )}
        </div>
      )}

      {/* Custom instructions */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
          <div>
            <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical">
              Assistant instructions
            </h2>
            <p className="text-body-sm text-ink-6 mt-0.5">
              Shape how the assistant speaks to your guests — tone, language, restrictions, or anything specific to your venue.
            </p>
          </div>
          <button
            onClick={saveInstructions}
            disabled={instrSaving}
            className="shrink-0 w-full sm:w-auto px-4 py-2 rounded-2 bg-saffron text-paper text-body-sm font-semibold hover:bg-saffron-2 transition-colors duration-hover disabled:opacity-50"
          >
            {instrSaved ? 'Saved' : instrSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={5}
          placeholder={`e.g. "Always respond in French. Never mention competitor restaurants. Suggest our house wine with every main course."`}
          className="w-full px-3 py-2.5 border-[1.5px] border-paper-4 rounded-2 text-body text-ink bg-paper focus-visible:outline-none focus-visible:border-saffron transition-[border-color] duration-standard resize-y placeholder:text-ink-6 text-[14px] leading-relaxed"
        />
      </div>

      {/* Top questions */}
      <div className="bg-paper border border-paper-3 rounded-3 p-5">
        <h2 className="font-display text-[22px] font-[500] text-ink tracking-[-0.005em] font-optical mb-1">
          Top questions
        </h2>
        <p className="text-body-sm text-ink-6 mb-4">
          Most common things guests asked {periodLabel}. Tap to see the answer.
        </p>

        {total === 0 ? (
          <div className="py-8 text-center">
            <p className="text-body-sm text-ink-6">
              {range === 'today'
                ? 'Questions will appear here once guests start using the assistant today.'
                : 'No conversations found in this period.'}
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
                    <div className="pb-3 pr-6">
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
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Sk className="h-8 w-36" />
          <Sk className="h-4 w-56" />
        </div>
        <Sk className="h-9 w-52 rounded-2" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-paper border border-paper-3 rounded-3 p-4 space-y-3">
            <Sk className="h-3 w-24" />
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

      <div className="bg-paper border border-paper-3 rounded-3 p-5 mb-6">
        <Sk className="h-6 w-44 mb-2" />
        <Sk className="h-4 w-80 mb-5" />
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
