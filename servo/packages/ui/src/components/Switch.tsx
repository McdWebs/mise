import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const switchId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <label
        htmlFor={switchId}
        className="inline-flex items-center gap-3 cursor-pointer select-none"
      >
        <span className="relative">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            className="sr-only peer"
            {...props}
          />
          {/* Track */}
          <span
            className={cn(
              'block w-10 h-6 rounded-pill',
              'bg-paper-3 transition-colors duration-standard ease-standard',
              'peer-checked:bg-saffron',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-saffron peer-focus-visible:ring-offset-2',
              'peer-disabled:opacity-40',
              className
            )}
          />
          {/* Thumb */}
          <span
            className={cn(
              'absolute top-1 left-1 block w-4 h-4 rounded-full bg-paper shadow-sm',
              'transition-transform duration-standard ease-standard',
              'peer-checked:translate-x-4',
            )}
          />
        </span>
        {label && <span className="text-body text-ink">{label}</span>}
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
