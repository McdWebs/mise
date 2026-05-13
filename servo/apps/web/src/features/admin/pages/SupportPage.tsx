import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AdminRestaurant } from '../hooks/useAdminRestaurant'

const TOPICS = ['Billing', 'Technical issue', 'Menu help', 'Account & access', 'Other'] as const
type Topic = typeof TOPICS[number]

const TOPIC_STYLES: Record<Topic, string> = {
  'Billing':          'bg-saffron/15 text-saffron-2',
  'Technical issue':  'bg-ember-wash text-ember-2',
  'Menu help':        'bg-herb-wash text-herb-2',
  'Account & access': 'bg-paper-3 text-ink-5',
  'Other':            'bg-paper-3 text-ink-5',
}

interface SupportTicket {
  id: string
  topic: string
  status: 'open' | 'closed'
  created_at: string
}

interface SupportMessage {
  id: string
  ticket_id: string | null
  restaurant_id: string
  sender_role: 'owner' | 'platform'
  body: string
  read_at: string | null
  created_at: string
}

interface OwnerTicket {
  id: string
  topic: string
  status: 'open' | 'closed'
  createdAt: string
  lastBody: string
  lastAt: string
  unreadCount: number
}

interface SupportPageProps {
  restaurant: AdminRestaurant
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

type View = 'list' | 'new' | 'thread'

export function SupportPage({ restaurant }: SupportPageProps) {
  const [view, setView] = useState<View>('list')
  const [tickets, setTickets] = useState<OwnerTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)

  // New ticket
  const [newTopic, setNewTopic] = useState<Topic | ''>('')
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Thread
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function loadTickets() {
    const [{ data: ticketData }, { data: msgData }] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id, topic, status, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('support_messages')
        .select('ticket_id, sender_role, body, read_at, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false }),
    ])

    const msgsByTicket = new Map<string, SupportMessage[]>()
    for (const m of (msgData ?? []) as SupportMessage[]) {
      if (!m.ticket_id) continue
      if (!msgsByTicket.has(m.ticket_id)) msgsByTicket.set(m.ticket_id, [])
      msgsByTicket.get(m.ticket_id)!.push(m)
    }

    const rows: OwnerTicket[] = ((ticketData ?? []) as SupportTicket[]).map(t => {
      const msgs = msgsByTicket.get(t.id) ?? []
      const sorted = [...msgs].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const last = sorted[0]
      const unread = msgs.filter(m => m.sender_role === 'platform' && !m.read_at).length
      return {
        id: t.id,
        topic: t.topic,
        status: t.status,
        createdAt: t.created_at,
        lastBody: last?.body ?? '',
        lastAt: last?.created_at ?? t.created_at,
        unreadCount: unread,
      }
    }).sort((a, b) => b.lastAt.localeCompare(a.lastAt))

    setTickets(rows)
    setLoadingTickets(false)
  }

  useEffect(() => {
    loadTickets()
  }, [restaurant.id])

  // Reload ticket list when a ticket status changes
  useEffect(() => {
    const channel = supabase
      .channel(`support-tickets-${restaurant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `restaurant_id=eq.${restaurant.id}` }, () => {
        void loadTickets()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant.id])

  // Fetch thread messages when a ticket is selected
  useEffect(() => {
    if (!selectedId) return
    const ticketId = selectedId
    let cancelled = false
    setLoadingThread(true)
    setMessages([])

    async function load() {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (cancelled) return
      const msgs = (data ?? []) as SupportMessage[]
      setMessages(msgs)
      setLoadingThread(false)

      // Mark platform messages as read
      const unreadIds = msgs.filter(m => m.sender_role === 'platform' && !m.read_at).map(m => m.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('support_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, unreadCount: 0 } : t))
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime for active thread
  useEffect(() => {
    if (!selectedId) return
    const channel = supabase
      .channel(`support-thread-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedId}` },
        async (payload) => {
          const msg = payload.new as SupportMessage
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          // Mark platform reply as read immediately
          if (msg.sender_role === 'platform' && !msg.read_at) {
            await supabase
              .from('support_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id)
            setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, unreadCount: 0 } : t))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedId])

  async function submitNewTicket() {
    if (!newTopic || !newBody.trim() || submitting) return
    setSubmitting(true)

    const { data: ticket, error: tErr } = await supabase
      .from('support_tickets')
      .insert({ restaurant_id: restaurant.id, topic: newTopic })
      .select()
      .single()

    if (tErr || !ticket) { setSubmitting(false); return }

    await supabase
      .from('support_messages')
      .insert({ restaurant_id: restaurant.id, ticket_id: ticket.id, sender_role: 'owner', body: newBody.trim() })

    setSubmitting(false)
    setNewTopic('')
    setNewBody('')
    await loadTickets()
    setSelectedId(ticket.id)
    setView('thread')
  }

  async function sendReply() {
    const body = input.trim()
    if (!body || sending || !selectedId) return
    setSending(true)
    setInput('')

    const selectedTicket = tickets.find(t => t.id === selectedId)
    if (!selectedTicket) { setSending(false); return }

    const { data, error } = await supabase
      .from('support_messages')
      .insert({ restaurant_id: restaurant.id, ticket_id: selectedId, sender_role: 'owner', body })
      .select()
      .single()
    if (!error && data) {
      const inserted = data as SupportMessage
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted])
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendReply()
    }
  }

  function openThread(ticketId: string) {
    setSelectedId(ticketId)
    setView('thread')
  }

  const selectedTicket = tickets.find(t => t.id === selectedId)

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="flex flex-col h-[calc(100dvh-56px)]">
        <div className="shrink-0 mb-5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 md:gap-y-0 md:items-end">
          <h1 className="col-start-1 row-start-1 min-w-0 self-start font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">
            Support
          </h1>
          <button
            type="button"
            onClick={() => setView('new')}
            aria-label="Open new ticket"
            className="col-start-2 row-start-1 self-start shrink-0 px-4 py-2 rounded-pill bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors duration-hover md:self-end md:row-span-2"
          >
            <span className="md:hidden">New</span>
            <span className="hidden md:inline">Open new ticket</span>
          </button>
          <div className="col-span-2 md:col-span-1 row-start-2 min-w-0 text-body-sm text-ink-6 md:mt-0.5">
            Contact the Servo team — we typically reply within a few hours.
          </div>
        </div>

        {restaurant.suspended && (
          <div className="shrink-0 px-4 py-3 bg-ember-wash border border-ember/30 rounded-2 mb-4 text-body-sm text-ember-2">
            Your restaurant is currently suspended. Open a ticket or reply to an existing one to contact Servo.
          </div>
        )}

        <div className="flex-1 min-h-0 bg-paper border border-paper-3 rounded-3 overflow-hidden flex flex-col">
          {loadingTickets ? (
            <div className="flex justify-center pt-16">
              <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-16 px-8">
              <p className="text-body font-semibold text-ink mb-1">No tickets yet</p>
              <p className="text-body-sm text-ink-6 max-w-[280px] leading-relaxed">
                Open a ticket to get in touch with the Servo team about billing, technical issues, your menu, or anything else.
              </p>
              <button
                onClick={() => setView('new')}
                className="mt-5 px-4 py-2 rounded-pill bg-ink text-paper text-body-sm font-semibold hover:bg-ink-3 transition-colors"
              >
                Open a ticket
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => openThread(ticket.id)}
                  className="w-full text-left px-5 py-4 border-b border-paper-3 hover:bg-paper-2 transition-colors duration-hover flex items-start gap-4"
                >
                  {/* Topic pill */}
                  <span className={`shrink-0 mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-pill ${TOPIC_STYLES[ticket.topic as Topic] ?? 'bg-paper-3 text-ink-5'}`}>
                    {ticket.topic}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[14px] font-semibold text-ink truncate">
                        {ticket.lastBody || '—'}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ticket.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-0.5 rounded-full bg-saffron text-paper text-[10px] font-semibold flex items-center justify-center tabular-nums">
                            {ticket.unreadCount}
                          </span>
                        )}
                        <span className="text-[12px] text-ink-7">{fmtRelative(ticket.lastAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-pill ${
                        ticket.status === 'open' ? 'bg-herb-wash text-herb-2' : 'bg-paper-3 text-ink-6'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-[12px] text-ink-7">
                        Opened {fmtRelative(ticket.createdAt)}
                      </span>
                    </div>
                  </div>

                  <span className="text-ink-7 text-[16px] shrink-0 mt-0.5">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── New ticket form ────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="flex flex-col h-[calc(100dvh-56px)]">
        <div className="shrink-0 mb-5">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-body-sm text-ink-6 hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to tickets
          </button>
          <h1 className="font-display text-[30px] font-[500] text-ink tracking-[-0.01em] font-optical">New ticket</h1>
          <div className="text-body-sm text-ink-6 mt-0.5">
            Tell us what you need help with and we'll get back to you.
          </div>
        </div>

        <div className="bg-paper border border-paper-3 rounded-3 p-6 max-w-[580px]">
          {/* Topic */}
          <div className="mb-5">
            <p className="text-body-sm font-semibold text-ink mb-2.5">What is this about?</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(topic => (
                <button
                  key={topic}
                  onClick={() => setNewTopic(topic)}
                  className={`px-3.5 py-2 rounded-pill text-body-sm font-medium transition-colors duration-hover ${
                    newTopic === topic
                      ? 'bg-ink text-paper'
                      : 'border border-paper-4 text-ink hover:border-ink-4'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="mb-5">
            <p className="text-body-sm font-semibold text-ink mb-2">Describe your issue</p>
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Describe what you need help with…"
              rows={5}
              className="w-full resize-none bg-paper-2 rounded-2 px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-7 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron/40 leading-relaxed"
            />
          </div>

          <button
            onClick={submitNewTicket}
            disabled={!newTopic || !newBody.trim() || submitting}
            className="px-5 py-2.5 rounded-pill bg-saffron text-paper text-body-sm font-semibold hover:bg-saffron-2 transition-colors disabled:opacity-40"
          >
            {submitting ? 'Opening ticket…' : 'Open ticket'}
          </button>
        </div>
      </div>
    )
  }

  // ── Thread view ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">
      <div className="shrink-0 mb-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-body-sm text-ink-6 hover:text-ink transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            Back to tickets
          </button>
          {selectedTicket && (
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[24px] font-[500] text-ink tracking-[-0.01em] font-optical leading-tight">
                {selectedTicket.topic}
              </h1>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-pill ${
                selectedTicket.status === 'open' ? 'bg-herb-wash text-herb-2' : 'bg-paper-3 text-ink-6'
              }`}>
                {selectedTicket.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {restaurant.suspended && (
        <div className="shrink-0 px-4 py-3 bg-ember-wash border border-ember/30 rounded-2 mb-4 text-body-sm text-ember-2">
          Your restaurant is currently suspended. Use this ticket to contact Servo and resolve the issue.
        </div>
      )}

      <div className="flex-1 min-h-0 bg-paper border border-paper-3 rounded-3 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
          {loadingThread && (
            <div className="flex justify-center pt-12">
              <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
            </div>
          )}

          {!loadingThread && messages.length === 0 && (
            <p className="text-body-sm text-ink-7 text-center pt-8">No messages yet.</p>
          )}

          {!loadingThread && messages.map((msg, i) => {
            const isOwner = msg.sender_role === 'owner'
            const showDate = i === 0 || !sameDay(messages[i - 1].created_at, msg.created_at)
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="text-[11px] text-ink-7 bg-paper-2 px-3 py-1 rounded-pill">
                      {fmtDate(msg.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isOwner ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className={`max-w-[75%] ${isOwner ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {!isOwner && (
                      <span className="text-[11px] text-ink-6 px-1">Servo support</span>
                    )}
                    <div
                      className={`px-3.5 py-2.5 rounded-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                        isOwner
                          ? 'bg-ink text-paper rounded-br-[4px]'
                          : 'bg-paper-2 text-ink rounded-bl-[4px]'
                      }`}
                    >
                      {msg.body}
                    </div>
                    <span className="text-[11px] text-ink-7 px-1">{fmtTime(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input or closed state */}
        {selectedTicket?.status === 'open' ? (
          <div className="shrink-0 border-t border-paper-3 px-4 py-3 flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Reply… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none bg-paper-2 rounded-2 px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-7 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron/40 leading-relaxed"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={sendReply}
              disabled={!input.trim() || sending}
              className="shrink-0 w-9 h-9 rounded-2 bg-saffron text-paper flex items-center justify-center disabled:opacity-30 hover:bg-saffron-2 transition-colors duration-hover"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-paper-3 px-4 py-3 text-center">
            <p className="text-body-sm text-ink-6">This ticket has been closed by the Servo team.</p>
          </div>
        )}
      </div>
    </div>
  )
}
