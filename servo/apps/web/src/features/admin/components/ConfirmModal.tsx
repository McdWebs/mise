import { useEffect } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(26,22,18,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="bg-paper rounded-3 shadow-2 p-6 max-w-[380px] w-full mx-5"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-display text-[20px] font-[500] text-ink tracking-[-0.01em] font-optical mb-2">
          {title}
        </h3>
        <p className="text-body-sm text-ink-6 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-2 border-[1.5px] border-paper-4 bg-paper text-ink text-body font-semibold hover:bg-paper-2 transition-colors duration-hover"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-[1.5] h-10 rounded-2 bg-ember text-paper text-body font-semibold hover:opacity-90 transition-opacity"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
