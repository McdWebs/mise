'use client'
import { type ReactNode, useEffect, useState, createContext, useContext, useCallback } from 'react'
import { cn } from '../lib/cn'

type ToastVariant = 'default' | 'success' | 'error' | 'warning'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  toast: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, options?: { variant?: ToastVariant; duration?: number }) => {
    const id = Math.random().toString(36).slice(2)
    const item: ToastItem = {
      id,
      message,
      variant: options?.variant ?? 'default',
      duration: options?.duration ?? 4000,
    }
    setToasts(prev => [...prev, item])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), item.duration)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastRegion toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

function ToastRegion({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} item={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const variantClasses: Record<ToastVariant, string> = {
    default: 'bg-ink text-paper',
    success: 'bg-herb text-paper',
    error:   'bg-ember text-paper',
    warning: 'bg-honey text-ink',
  }

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center justify-between gap-3',
        'rounded-2 px-4 py-3 shadow-2',
        'transition-all duration-standard ease-standard',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        variantClasses[item.variant]
      )}
    >
      <p className="text-body-sm">{item.message}</p>
      <button
        onClick={() => onRemove(item.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
