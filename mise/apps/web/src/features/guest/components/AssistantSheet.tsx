import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Send, X, ShoppingCart, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AssistantMessageContent } from './AssistantMessageContent'
import type { CartLineInput } from '../store/cartStore'

interface SuggestedItem {
  id: string
  name: string
  priceCents: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  suggestions?: SuggestedItem[]
}

interface AssistantSheetProps {
  restaurantId: string
  restaurantName: string
  tableLabel: string
  currency: string
  onAddLine: (line: CartLineInput) => void
  onClose: () => void
}

const QUICK_REPLIES = ["What's vegetarian?", "Anything spicy?", "Allergens?", "Wine pairing"]

/** Extract every **bold** name from an assistant message. */
function extractBoldNames(text: string): string[] {
  const matches = text.match(/\*\*([^*]+)\*\*/g) ?? []
  return [...new Set(matches.map(m => m.replace(/\*\*/g, '').trim()))].filter(Boolean)
}

/** Look up bold-named items in the menu and return those that are orderable. */
async function resolveMenuItems(restaurantId: string, names: string[]): Promise<SuggestedItem[]> {
  if (names.length === 0) return []
  const { data: cats } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
  const catIds = (cats ?? []).map((c: { id: string }) => c.id)
  if (catIds.length === 0) return []

  // Run one ilike query per name so partial/case mismatches still resolve
  const results = await Promise.all(
    names.map(name =>
      supabase
        .from('menu_items')
        .select('id, name, price_cents')
        .in('category_id', catIds)
        .eq('available', true)
        .ilike('name', name)
        .limit(1)
        .maybeSingle()
    )
  )

  const seen = new Set<string>()
  return results
    .map(r => r.data as { id: string; name: string; price_cents: number } | null)
    .filter((i): i is { id: string; name: string; price_cents: number } => i !== null && !seen.has(i.id) && !!seen.add(i.id))
    .map(i => ({ id: i.id, name: i.name, priceCents: i.price_cents }))
}

function fmtPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

function SuggestionChips({
  items,
  currency,
  onAdd,
}: {
  items: SuggestedItem[]
  currency: string
  onAdd: (item: SuggestedItem) => void
}) {
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  function handleAdd(item: SuggestedItem) {
    onAdd(item)
    setAddedIds(prev => new Set(prev).add(item.id))
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }, 1800)
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map(item => {
        const added = addedIds.has(item.id)
        return (
          <button
            key={item.id}
            onClick={() => handleAdd(item)}
            disabled={added}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2 border text-[12px] font-medium transition-colors duration-hover ${
              added
                ? 'bg-herb-wash border-herb text-herb'
                : 'bg-paper border-paper-4 text-ink hover:border-ink hover:bg-paper-2'
            }`}
          >
            {added ? <Check size={12} /> : <ShoppingCart size={12} />}
            <span>{item.name}</span>
            <span className="text-ink-5 font-normal">{fmtPrice(item.priceCents, currency)}</span>
          </button>
        )
      })}
    </div>
  )
}

export function AssistantSheet({ restaurantId, restaurantName, tableLabel, currency, onAddLine, onClose }: AssistantSheetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I know what's on tonight's menu at ${restaurantName}. Ask about ingredients, allergens, what's vegetarian, or what pairs with what.`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingReply, setAwaitingReply] = useState(false)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [handleClose])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMessage: Message = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])
    setDraft('')
    setLoading(true)
    setAwaitingReply(true)

    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (!apiBase) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'The menu assistant will be available shortly. A member of the team is happy to help in the meantime.' },
        ])
        setLoading(false)
        setAwaitingReply(false)
      }, 600)
      return
    }

    try {
      const res = await fetch(`${apiBase}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          tableLabel,
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('No response from assistant.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      // Append empty assistant message to stream into
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)

        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as {
              delta?: string
              type?: string
              items?: SuggestedItem[]
            }

            if (parsed.type === 'suggestions' && Array.isArray(parsed.items) && parsed.items.length > 0) {
              // Attach suggestions to the last assistant message
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, suggestions: parsed.items }
                }
                return updated
              })
            } else if (parsed.delta) {
              assistantContent += parsed.delta
              if (assistantContent.length > 0) setAwaitingReply(false)
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantContent }
                }
                return updated
              })
            }
          } catch {
            // non-JSON line, skip
          }
        }
      }
    } catch {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        const fallback: Message = {
          role: 'assistant',
          content: "Couldn't reach the assistant right now. A server is happy to help.",
        }
        if (last?.role === 'assistant' && last.content === '')
          return [...prev.slice(0, -1), fallback]
        return [...prev, fallback]
      })
    } finally {
      setLoading(false)
      setAwaitingReply(false)
      // Resolve bold-named items from the finished message and attach as chips
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (!last || last.role !== 'assistant' || !last.content) return prev
        const boldNames = extractBoldNames(last.content)
        if (boldNames.length === 0) return prev
        resolveMenuItems(restaurantId, boldNames).then(suggestions => {
          if (suggestions.length === 0) return
          setMessages(current => {
            const updated = [...current]
            // find the last assistant message to attach chips to
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'assistant') {
                updated[i] = { ...updated[i], suggestions }
                break
              }
            }
            return updated
          })
        })
        return prev
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center"
      style={{
        background: 'rgba(26,22,18,0.4)',
        opacity: open ? 1 : 0,
        transition: 'opacity 240ms ease',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[420px] bg-paper rounded-t-[16px] px-5 pb-5 pt-2 flex flex-col h-[60dvh] max-h-[88dvh] min-h-0 overflow-hidden"
        style={{
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.2,0.8,0.2,1)',
          willChange: 'transform',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu assistant"
      >
        {/* Handle */}
        <div className="shrink-0 w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3" />

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-ink text-saffron flex items-center justify-center font-display font-[500] text-[16px] shrink-0">
            M
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink">Mise · menu assistant</p>
            <p className="text-[12px] text-ink-6">Answers grounded in tonight's menu</p>
          </div>
          <button
            onClick={handleClose}
            className="ml-auto text-ink-6 hover:text-ink transition-colors duration-hover p-1"
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-1">
          {messages.map((m, i) => {
            const isLastAssistant = m.role === 'assistant' && i === messages.length - 1
            const showConnecting = isLastAssistant && awaitingReply && m.content === ''
            const showStreaming = isLastAssistant && loading && !awaitingReply && m.content.length > 0

            return (
              <div key={i} className={`flex flex-col ${m.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 text-[14px] leading-[1.5] ${
                    m.role === 'assistant'
                      ? 'bg-paper-2 rounded-[14px_14px_14px_4px] text-ink'
                      : 'bg-saffron text-paper rounded-[14px_14px_4px_14px]'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <>
                      {m.content ? <AssistantMessageContent text={m.content} /> : null}
                      {showConnecting && (
                        <div className="flex items-center gap-2 text-ink-6 min-h-[1.25rem]" aria-live="polite" aria-busy="true">
                          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                          <span className="text-[13px]">Checking the menu…</span>
                        </div>
                      )}
                      {showStreaming && (
                        <span
                          className="inline-block w-0.5 h-[1em] ml-0.5 align-[-0.15em] bg-ink animate-pulse rounded-sm"
                          aria-hidden
                        />
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>

                {/* Add-to-cart chips */}
                {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                  <SuggestionChips
                    items={m.suggestions}
                    currency={currency}
                    onAdd={item =>
                      onAddLine({
                        kind: 'menu',
                        menuItemId: item.id,
                        name: item.name,
                        unitPriceCents: item.priceCents,
                        modifiers: [],
                      })
                    }
                  />
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="shrink-0 flex flex-wrap gap-1.5 my-3.5">
          {QUICK_REPLIES.map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              className="px-[11px] py-[6px] rounded-pill border border-[1.5px] border-paper-4 text-[12px] font-medium text-ink bg-paper hover:bg-paper-2 transition-colors duration-hover disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={e => { e.preventDefault(); send(draft) }}
          className="shrink-0 flex items-center gap-2 border border-[1.5px] border-paper-4 rounded-pill px-4 py-[10px]"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Ask about anything on the menu…"
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-ink placeholder:text-ink-8 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading}
            className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-ink-2 transition-colors duration-hover"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
