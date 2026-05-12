'use client'
import { type ReactNode, useEffect } from 'react'
import { cn } from '../lib/cn'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  width?: string
}

export function Drawer({ open, onClose, title, children, className, width = 'w-[480px]' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink/20 transition-opacity duration-standard',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 flex flex-col',
          'bg-paper border-l border-paper-3 shadow-2',
          'transition-transform duration-large ease-standard',
          width,
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-paper-3 shrink-0">
            <h2 className="text-h2 text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-7 hover:text-ink transition-colors duration-hover p-1 rounded-2"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  )
}
