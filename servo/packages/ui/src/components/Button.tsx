import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const buttonVariants = cva(
  // Base — all buttons share these
  [
    'inline-flex items-center justify-center gap-2 font-sans font-medium',
    'select-none whitespace-nowrap rounded-2',
    'transition-all duration-standard ease-standard',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:scale-[0.98] active:duration-press',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-saffron text-paper shadow-none',
          'hover:bg-saffron-2 hover:duration-hover',
          'active:bg-saffron-3',
        ],
        secondary: [
          'bg-transparent text-ink border border-paper-3',
          'hover:bg-paper-2 hover:border-paper-4 hover:duration-hover',
          'active:bg-paper-3',
        ],
        ghost: [
          'bg-transparent text-ink',
          'hover:bg-paper-2 hover:duration-hover',
          'active:bg-paper-3',
        ],
        destructive: [
          'bg-ember text-paper',
          'hover:bg-ember-2 hover:duration-hover',
          'active:bg-ember-2',
        ],
        link: [
          'bg-transparent text-steel underline-offset-4',
          'hover:underline hover:duration-hover',
          'h-auto p-0',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-body-sm',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
