import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { supabasePlatform as supabase } from '@/lib/supabasePlatform'

interface SupportMessage {
  id: string
  ticket_id: string | null
  restaurant_id: string
  sender_role: 'owner' | 'platform' | 'ai'
  body: string
  read_at: string | null
  created_at: string
}

interface TicketThreadProps {
  ticketId: string
  restaurantId: string
  restaurantName: string
  ticketStatus: 'open' | 'closed'
  isReadOnly?: boolean
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function TicketThread({ ticketId, restaurantId, restaurantName, ticketStatus, isReadOnly }: TicketThreadProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
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
      setLoading(false)

      const unreadIds = msgs.filter(m => m.sender_role === 'owner' && !m.read_at).map(m => m.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('support_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
      }
    }

    load()
    return () => { cancelled = true }
  }, [ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-platform-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        async (payload) => {
          const msg = payload.new as SupportMessage
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.sender_role === 'owner' && !msg.read_at) {
            await supabase
              .from('support_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', msg.id)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ticketId])

  async function send() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')
    const { data, error } = await supabase
      .from('support_messages')
      .insert({ restaurant_id: restaurantId, ticket_id: ticketId, sender_role: 'platform', body })
      .select()
      .single()
    if (!error && data) {
      const inserted = data as SupportMessage
      setMessages(prev => prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted])
    }
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {loading && (
          <div className="flex justify-center pt-8">
            <div className="w-4 h-4 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-body-sm text-ink-7 text-center pt-8">No messages in this ticket yet.</p>
        )}

        {!loading && messages.map((msg, i) => {
          const isRight = msg.sender_role === 'platform' || msg.sender_role === 'ai'
          const isAi = msg.sender_role === 'ai'
          const showDate = i === 0 || !sameDay(messages[i - 1].created_at, msg.created_at)
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] text-ink-7 bg-paper-2 px-2.5 py-0.5 rounded-pill">
                    {fmtDate(msg.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-1.5`}>
                <div className={`max-w-[80%] flex flex-col gap-0.5 ${isRight ? 'items-end' : 'items-start'}`}>
                  {!isRight && (
                    <span className="text-[10px] text-ink-6 px-1">{restaurantName}</span>
                  )}
                  {isAi && (
                    <div className="flex items-center gap-1 px-1 mb-0.5">
                      <Sparkles size={10} className="text-saffron" />
                      <span className="text-[10px] text-ink-6">Mise AI</span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                      isAi
                        ? 'bg-saffron/10 text-ink rounded-br-[3px]'
                        : isRight
                        ? 'bg-ink text-paper rounded-br-[3px]'
                        : 'bg-paper-2 text-ink rounded-bl-[3px]'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <span className="text-[10px] text-ink-7 px-1">{fmtTime(msg.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {isReadOnly ? null : ticketStatus === 'open' ? (
        <div className="shrink-0 border-t border-paper-3 pt-3 flex items-end gap-2 mt-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Reply…"
            rows={1}
            className="flex-1 resize-none bg-paper-2 rounded-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-7 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron/40"
            style={{ maxHeight: '72px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 72)}px`
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="shrink-0 w-8 h-8 rounded-2 bg-saffron text-paper flex items-center justify-center disabled:opacity-30 hover:bg-saffron-2 transition-colors"
            aria-label="Send reply"
          >
            <Send size={13} />
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-t border-paper-3 pt-3 mt-2">
          <p className="text-[12px] text-ink-6 text-center">This ticket is closed.</p>
        </div>
      )}
    </div>
  )
}
