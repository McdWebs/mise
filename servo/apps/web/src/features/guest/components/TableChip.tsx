interface TableChipProps {
  label: string
  variant?: 'dark' | 'light'
}

export function TableChip({ label, variant = 'dark' }: TableChipProps) {
  if (variant === 'light') {
    return (
      <span className="inline-flex items-center gap-2 px-3.5 py-2 bg-paper border border-paper-3 rounded-pill font-mono text-[12px] font-semibold text-ink">
        {label}
        <span className="text-[13px] text-ink-6 font-sans font-normal">· seated at</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-[5px] bg-ink text-paper rounded-pill font-mono text-[12px] font-semibold whitespace-nowrap">
      {label}
    </span>
  )
}
