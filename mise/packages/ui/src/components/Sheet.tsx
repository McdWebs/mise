'use client'
import { type HTMLAttributes, type ReactNode, useEffect } from 'react'
import { cn } from '../lib/cn'

export interface SheetProps {
  open: boolean
  onClose: () => void
  side?: 'bottom' | 'right'
  title?: string
  children: ReactNode
  className?: string
}

export function Sheet({ open, onClose, side = 'bottom', title, children, className }: SheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const panelClasses = side === 'bottom'
    ? cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'max-h-[90dvh] rounded-t-3 overflow-y-auto',
        'bg-paper border-t border-paper-3 shadow-2',
        'animate-slide-up',
        className
      )
    : cn(
        'fixed top-0 right-0 bottom-0 z-50 w-[400px] max-w-full',
        'overflow-y-auto bg-paper border-l border-paper-3 shadow-2',
        className
      )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div role="dialog" aria-modal="true" aria-label={title} className={panelClasses}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-paper-3 sticky top-0 bg-paper z-10">
            <h2 className="text-h2 text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-7 hover:text-ink transition-colors duration-hover p-1"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </>
  )
}
