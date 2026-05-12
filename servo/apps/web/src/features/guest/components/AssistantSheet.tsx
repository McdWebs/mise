import { useState, useEffect, useRef } from 'react'
import { Send, X } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
}

interface AssistantSheetProps {
  restaurantId: string
  restaurantName: string
  tableLabel: string
  onClose: () => void
}

const QUICK_REPLIES = ["What's vegetarian?", "Anything spicy?", "Allergens?", "Wine pairing"]

export function AssistantSheet({ restaurantId, restaurantName, tableLabel, onClose }: AssistantSheetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `I know what's on tonight's menu at ${restaurantName}. Ask about ingredients, allergens, what's vegetarian, or what pairs with what.`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

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

    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (!apiBase) {
      // Phase 6 not yet wired — show placeholder
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'The menu assistant will be available shortly. A member of the team is happy to help in the meantime.' },
        ])
        setLoading(false)
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

      // Stream SSE text/event-stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content ?? parsed.delta ?? ''
              assistantContent += delta
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            } catch {
              // non-JSON line, skip
            }
          }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Couldn\'t reach the assistant right now. A server is happy to help.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center"
      style={{ background: 'rgba(26,22,18,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-paper rounded-t-[16px] px-5 pb-5 pt-2 flex flex-col animate-slide-up"
        style={{ minHeight: '60dvh', maxHeight: '88dvh' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menu assistant"
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-paper-4 rounded-pill mx-auto mt-1.5 mb-3" />

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-ink text-saffron flex items-center justify-center font-display font-[500] text-[16px] shrink-0">
            S
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink">Servo · menu assistant</p>
            <p className="text-[12px] text-ink-6">Answers grounded in tonight's menu</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-ink-6 hover:text-ink transition-colors duration-hover p-1"
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] px-3.5 py-2.5 text-[14px] leading-[1.5] ${
                m.role === 'assistant'
                  ? 'bg-paper-2 rounded-[14px_14px_14px_4px] self-start text-ink'
                  : 'bg-saffron text-paper rounded-[14px_14px_4px_14px] self-end'
              }`}
            >
              {m.content}
              {m.role === 'assistant' && loading && i === messages.length - 1 && m.content === '' && (
                <span className="inline-flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-ink-6 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-ink-6 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-ink-6 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick replies */}
        <div className="flex flex-wrap gap-1.5 my-3.5">
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
          className="flex items-center gap-2 border border-[1.5px] border-paper-4 rounded-pill px-4 py-[10px]"
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
