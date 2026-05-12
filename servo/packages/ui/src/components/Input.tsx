import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label text-ink font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-2 bg-paper px-3',
            'border border-[1.5px] border-paper-4',
            'font-sans text-body text-ink placeholder:text-ink-8',
            'transition-[border-color,box-shadow] duration-standard ease-standard',
            'focus-visible:outline-none focus-visible:border-saffron focus-visible:border-2',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            error && 'border-ember focus-visible:border-ember',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-body-sm text-ink-6">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-body-sm text-ember" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
