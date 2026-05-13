import { useEffect, useState } from 'react'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'
import { TicketThread } from './TicketThread'

const TOPIC_STYLES: Record<string, string> = {
  'Billing':          'bg-saffron/15 text-saffron-2',
  'Technical issue':  'bg-ember-wash text-ember-2',
  'Menu help':        'bg-herb-wash text-herb-2',
  'Account & access': 'bg-paper-3 text-ink-5',
  'Other':            'bg-paper-3 text-ink-5',
}

function topicStyle(topic: string) {
  return TOPIC_STYLES[topic] ?? 'bg-paper-3 text-ink-5'
}

interface SupportTicket {
  id: string
  restaurant_id: string
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

interface RestaurantRow {
  id: string
  name: string
  suspended: boolean
}

interface TicketRow {
  id: string
  restaurantId: string
  restaurantName: string
  suspended: boolean
  topic: string
  status: 'open' | 'closed'
  lastBody: string
  lastAt: string
  unreadCount: number
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

function buildTicketList(
  tickets: SupportTicket[],
  messages: SupportMessage[],
  restaurants: RestaurantRow[]
): TicketRow[] {
  const restaurantMap = new Map(restaurants.map(r => [r.id, r]))
  const msgsByTicket = new Map<string, SupportMessage[]>()

  for (const m of messages) {
    if (!m.ticket_id) continue
    if (!msgsByTicket.has(m.ticket_id)) msgsByTicket.set(m.ticket_id, [])
    msgsByTicket.get(m.ticket_id)!.push(m)
  }

  return tickets
    .map(ticket => {
      const r = restaurantMap.get(ticket.restaurant_id)
      const msgs = msgsByTicket.get(ticket.id) ?? []
      const sorted = [...msgs].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const last = sorted[0]
      const unread = msgs.filter(m => m.sender_role === 'owner' && !m.read_at).length
      return {
        id: ticket.id,
        restaurantId: ticket.restaurant_id,
        restaurantName: r?.name ?? 'Unknown',
        suspended: r?.suspended ?? false,
        topic: ticket.topic,
        status: ticket.status,
        lastBody: last?.body ?? '',
        lastAt: last?.created_at ?? ticket.created_at,
        unreadCount: unread,
      }
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

type StatusFilter = 'open' | 'closed' | 'all'

export function MessagesView() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [closing, setClosing] = useState(false)

  async function fetchAll(keepSelected = true) {
    const [{ data: ticketData }, { data: msgData }, { data: restaurants }] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id, restaurant_id, topic, status, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('support_messages')
        .select('id, ticket_id, restaurant_id, sender_role, body, read_at, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('restaurants').select('id, name, suspended'),
    ])

    const rows = buildTicketList(
      (ticketData ?? []) as SupportTicket[],
      (msgData ?? []) as SupportMessage[],
      (restaurants ?? []) as RestaurantRow[]
    )
    setTickets(rows)

    if (!keepSelected || !selected) {
      const firstUnread = rows.find(t => t.unreadCount > 0 && t.status === 'open')
      setSelected(firstUnread?.id ?? rows.find(t => t.status === 'open')?.id ?? rows[0]?.id ?? null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll(false)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('messages-view-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        void fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        void fetchAll()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function setTicketStatus(ticketId: string, status: 'open' | 'closed') {
    setClosing(true)
    await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
    setTickets(prev =>
      prev.map(t => t.id === ticketId ? { ...t, status } : t)
    )
    setClosing(false)
  }

  const filtered = tickets.filter(t =>
    statusFilter === 'all' ? true : t.status === statusFilter
  )

  const selectedTicket = tickets.find(t => t.id === selected)

  return (
    <div className="flex gap-0 h-[calc(100dvh-57px)] -mx-8 -my-7">

      {/* Left: ticket list */}
      <div className="w-[300px] shrink-0 border-r border-paper-3 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-paper-3 shrink-0">
          <h2 className="font-display text-[20px] font-[500] text-ink tracking-[-0.01em] font-optical">Messages</h2>
          <p className="text-[12px] text-ink-6 mt-0.5">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Status filter */}
        <div className="flex gap-1 px-3 py-2.5 border-b border-paper-3 shrink-0">
          {(['open', 'closed', 'all'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex-1 py-1 rounded-pill text-[11px] font-semibold capitalize transition-colors duration-hover ${
                statusFilter === f ? 'bg-ink text-paper' : 'text-ink-6 hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center pt-12">
              <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-5 pt-12 text-center">
              <p className="text-body-sm text-ink-6">No {statusFilter !== 'all' ? statusFilter : ''} tickets.</p>
            </div>
          )}

          {filtered.map(ticket => {
            const isActive = ticket.id === selected
            return (
              <button
                key={ticket.id}
                onClick={() => setSelected(ticket.id)}
                className={`w-full text-left px-4 py-3 border-b border-paper-3 transition-colors duration-hover ${
                  isActive ? 'bg-ink' : 'hover:bg-paper-2'
                }`}
              >
                {/* Row 1: restaurant name + unread + time */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {ticket.suspended && (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-ember mt-0.5" />
                    )}
                    <span className={`text-[13px] font-semibold truncate ${isActive ? 'text-paper' : 'text-ink'}`}>
                      {ticket.restaurantName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ticket.unreadCount > 0 && (
                      <span className="min-w-[16px] h-[16px] px-0.5 rounded-full bg-ember text-paper text-[10px] font-semibold flex items-center justify-center tabular-nums">
                        {ticket.unreadCount > 9 ? '9+' : ticket.unreadCount}
                      </span>
                    )}
                    <span className={`text-[11px] ${isActive ? 'text-paper/60' : 'text-ink-7'}`}>
                      {fmtRelative(ticket.lastAt)}
                    </span>
                  </div>
                </div>
                {/* Row 2: topic pill + status */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-pill ${
                    isActive ? 'bg-paper/15 text-paper' : topicStyle(ticket.topic)
                  }`}>
                    {ticket.topic}
                  </span>
                  {ticket.status === 'closed' && (
                    <span className={`text-[10px] ${isActive ? 'text-paper/50' : 'text-ink-6'}`}>· closed</span>
                  )}
                </div>
                {/* Row 3: last message preview */}
                <p className={`text-[12px] truncate ${isActive ? 'text-paper/70' : 'text-ink-6'}`}>
                  {ticket.lastBody}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTicket ? (
          <>
            <div className="px-7 py-4 border-b border-paper-3 shrink-0 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-display text-[18px] font-[500] text-ink tracking-[-0.01em] font-optical">
                    {selectedTicket.restaurantName}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${topicStyle(selectedTicket.topic)}`}>
                    {selectedTicket.topic}
                  </span>
                </div>
                {selectedTicket.suspended && (
                  <span className="text-[12px] text-ember">Suspended account</span>
                )}
              </div>
              <button
                onClick={() => setTicketStatus(selectedTicket.id, selectedTicket.status === 'open' ? 'closed' : 'open')}
                disabled={closing}
                className={`px-3 py-1.5 rounded-2 text-body-sm font-semibold transition-colors duration-hover disabled:opacity-40 ${
                  selectedTicket.status === 'open'
                    ? 'border border-paper-4 text-ink-5 hover:border-ink-4 hover:text-ink'
                    : 'bg-herb-wash text-herb-2 hover:bg-herb/20'
                }`}
              >
                {selectedTicket.status === 'open' ? 'Close ticket' : 'Reopen ticket'}
              </button>
            </div>

            <div className="flex-1 overflow-hidden px-7 py-5">
              <TicketThread
                key={selectedTicket.id}
                ticketId={selectedTicket.id}
                restaurantId={selectedTicket.restaurantId}
                restaurantName={selectedTicket.restaurantName}
                ticketStatus={selectedTicket.status}
              />
            </div>
          </>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-body font-semibold text-ink mb-1">No ticket selected</p>
              <p className="text-body-sm text-ink-6">Pick a ticket from the list.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
