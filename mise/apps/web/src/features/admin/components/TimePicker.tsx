import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TimePickerProps {
  value: string          // "HH:MM" or ""
  onChange: (v: string) => void
  placeholder?: string
}

function fmtDisplay(value: string): string {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const MINUTES = [0, 15, 30, 45]

export function TimePicker({ value, onChange, placeholder = 'Pick a time' }: TimePickerProps) {
  const [open, setOpen]               = useState(false)
  const [pendingHour, setPendingHour] = useState<number | null>(null)
  const [pos, setPos]                 = useState({ top: 0, left: 0 })
  const triggerRef                    = useRef<HTMLButtonElement>(null)
  const dropdownRef                   = useRef<HTMLDivElement>(null)

  const parsedHour   = value ? Number(value.split(':')[0]) : null
  const parsedMinute = value ? Number(value.split(':')[1]) : null
  const activeHour   = pendingHour !== null ? pendingHour : parsedHour
  const activeMinute = parsedMinute

  function openDropdown() {
    if (triggerRef.current) {
      const rect   = triggerRef.current.getBoundingClientRect()
      const W      = 228
      const H      = 340 // approx dropdown height
      const vw     = window.innerWidth
      const vh     = window.innerHeight

      const left = rect.left + W > vw ? Math.max(4, rect.right - W) : rect.left
      const top  = rect.bottom + 6 + H > vh ? rect.top - 6 - H : rect.bottom + 6

      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  // Close on outside click — check both trigger and portal dropdown
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // Reset pending hour when popup closes
  useEffect(() => {
    if (!open) setPendingHour(null)
  }, [open])

  function selectTime(h: number, m: number) {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    setPendingHour(null)
    setOpen(false)
  }

  const display = fmtDisplay(value)

  return (
    <>
      {/* Trigger — same style as DatePicker */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={`flex items-center px-2.5 py-1.5 border-[1.5px] rounded-2 text-body-sm bg-paper transition-[border-color] duration-standard focus-visible:outline-none w-full sm:w-auto ${
          open ? 'border-saffron' : 'border-paper-4 hover:border-ink-5'
        }`}
      >
        <span className={display ? 'text-ink' : 'text-ink-5'}>
          {display || placeholder}
        </span>
      </button>

      {/* Dropdown rendered in body via portal — avoids overflow scroll in any ancestor */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[9999] bg-paper border border-paper-3 rounded-3 shadow-2 p-4 w-[228px]"
        >
          {/* Hour grid header */}
          <p className="text-[10px] font-semibold text-ink-6 uppercase tracking-widest mb-2 select-none">
            Hour
          </p>

          {/* Hours: 4 per row × 6 rows */}
          <div className="grid grid-cols-4 gap-y-0.5 mb-3">
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  if (activeMinute !== null) {
                    selectTime(h, activeMinute)
                  } else {
                    setPendingHour(h)
                  }
                }}
                className={`mx-auto w-[46px] h-8 flex items-center justify-center text-[13px] font-medium rounded-2 transition-colors ${
                  h === activeHour ? 'bg-saffron text-paper' : 'text-ink hover:bg-paper-2'
                }`}
              >
                {String(h).padStart(2, '0')}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-paper-3 mb-3" />

          {/* Minute header */}
          <p className="text-[10px] font-semibold text-ink-6 uppercase tracking-widest mb-2 select-none">
            Minute
          </p>

          {/* Minutes: :00 :15 :30 :45 */}
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => selectTime(activeHour ?? new Date().getHours(), m)}
                className={`h-8 flex items-center justify-center text-[13px] font-medium rounded-2 transition-colors ${
                  m === activeMinute ? 'bg-saffron text-paper' : 'text-ink hover:bg-paper-2'
                }`}
              >
                :{String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
