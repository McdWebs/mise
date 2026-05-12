import type { CSSProperties } from 'react'

export function Sk({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`bg-paper-3 animate-pulse rounded-2 ${className}`} style={style} />
}
