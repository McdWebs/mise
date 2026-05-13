import { cn } from '@mise/ui'

interface DietTagProps {
  tag: string
}

export function DietTag({ tag }: DietTagProps) {
  return (
    <span
      className={cn(
        'text-[10px] px-1.5 py-0.5 rounded-1 font-semibold tracking-[0.02em]',
        'bg-paper-2',
        tag === 'Spicy' && 'text-saffron-3',
        tag === 'Contains fish' || tag === 'Contains nuts' ? 'text-ember' : '',
        tag !== 'Spicy' && tag !== 'Contains fish' && tag !== 'Contains nuts' && 'text-herb-2',
      )}
    >
      {tag}
    </span>
  )
}
