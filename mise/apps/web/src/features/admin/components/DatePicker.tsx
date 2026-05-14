import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string        // YYYY-MM-DD
  onChange: (v: string) => void
  min?: string         // YYYY-MM-DD
  max?: string         // YYYY-MM-DD
  placeholder?: string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const days: Date[] = []
  for (let i = 0; i < first.getDay(); i++)
    days.push(new Date(year, month, 1 - (first.getDay() - i)))
  for (let d = 1; d <= last.getDate(); d++)
    days.push(new Date(year, month, d))
  let n = 1
  while (days.length % 7 !== 0) days.push(new Date(year, month + 1, n++))
  return days
}

export function DatePicker({ value, onChange, min, max, placeholder = 'Pick a date' }: DatePickerProps) {
  const todayISO = toISO(new Date())
  const parsed   = value ? new Date(value + 'T12:00:00') : null

  const [open, setOpen]         = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const display = parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const grid = buildGrid(viewYear, viewMonth)

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center px-2.5 py-1.5 border-[1.5px] rounded-2 text-body-sm bg-paper transition-[border-color] duration-standard focus-visible:outline-none w-full sm:w-auto ${
          open ? 'border-saffron' : 'border-paper-4 hover:border-ink-5'
        }`}
      >
        <span className={display ? 'text-ink' : 'text-ink-5'}>
          {display || placeholder}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-paper border border-paper-3 rounded-3 shadow-2 p-4 w-[272px]">

          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-2 hover:bg-paper-2 text-ink-5 hover:text-ink transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-body-sm font-semibold text-ink select-none">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-2 hover:bg-paper-2 text-ink-5 hover:text-ink transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-ink-6 uppercase tracking-widest py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((d, i) => {
              const iso          = toISO(d)
              const inMonth      = d.getMonth() === viewMonth
              const isSelected   = iso === value
              const isToday      = iso === todayISO
              const isDisabled   = (!!min && iso < min) || (!!max && iso > max)

              if (!inMonth) return <div key={i} />

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { onChange(iso); setOpen(false) }}
                  className={`mx-auto w-8 h-8 flex items-center justify-center text-[13px] font-medium rounded-2 transition-colors ${
                    isSelected
                      ? 'bg-saffron text-paper'
                      : isDisabled
                      ? 'text-ink-6 opacity-40 cursor-not-allowed'
                      : isToday
                      ? 'border border-saffron text-saffron hover:bg-paper-2'
                      : 'text-ink hover:bg-paper-2'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
