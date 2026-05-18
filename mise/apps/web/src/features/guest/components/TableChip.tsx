interface TableChipProps {
  label: string
  variant?: 'dark' | 'light'
}

export function TableChip({ label, variant = 'dark' }: TableChipProps) {
  if (variant === 'light') {
    return (
      <span className="inline-flex items-center px-3.5 py-2 bg-paper border border-paper-3 rounded-pill font-mono text-[12px] font-semibold text-ink">
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[12px] font-semibold text-paper whitespace-nowrap">
      {label}
    </span>
  )
}
