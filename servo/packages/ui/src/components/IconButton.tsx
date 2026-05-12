import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-2 shrink-0',
    'transition-all duration-standard ease-standard',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:scale-[0.98] active:duration-press',
  ],
  {
    variants: {
      variant: {
        ghost: [
          'text-ink-7 bg-transparent',
          'hover:bg-paper-2 hover:text-ink hover:duration-hover',
          'active:bg-paper-3',
        ],
        outline: [
          'text-ink border border-paper-3 bg-transparent',
          'hover:bg-paper-2 hover:border-paper-4 hover:duration-hover',
          'active:bg-paper-3',
        ],
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  }
)

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  )
)
IconButton.displayName = 'IconButton'

export { IconButton, iconButtonVariants }
