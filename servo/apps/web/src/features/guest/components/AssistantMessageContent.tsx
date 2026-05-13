import { Fragment, type ReactNode } from 'react'

/** Renders **bold** and soft line breaks; paragraphs from blank lines; "- " / "• " lists. */
function formatInline(text: string): ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*)/g)
  return segments.map((seg, i) => {
    const bold = seg.match(/^\*\*(.+)\*\*$/)
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {bold[1]}
        </strong>
      )
    }
    return <Fragment key={i}>{seg}</Fragment>
  })
}

export function AssistantMessageContent({ text }: { text: string }) {
  if (!text.trim()) return null

  const blocks = text.trim().split(/\n\n+/)

  return (
    <div className="space-y-2 [&_p]:m-0">
      {blocks.map((block, bi) => {
        const lines = block.split('\n')
        const nonEmpty = lines.map(l => l.trim()).filter(Boolean)
        const isBulletBlock =
          nonEmpty.length > 0 &&
          nonEmpty.every(l => /^[-*•]/.test(l))

        if (isBulletBlock) {
          return (
            <ul key={bi} className="list-disc pl-4 space-y-1 marker:text-ink-6">
              {lines
                .map(l => l.trim())
                .filter(Boolean)
                .map((l, li) => (
                  <li key={li} className="pl-0.5">
                    {formatInline(l.replace(/^[-*•]\s*/, ''))}
                  </li>
                ))}
            </ul>
          )
        }

        const single = lines.join('\n').trim()
        if (!single) return null

        return (
          <p key={bi} className="whitespace-pre-wrap break-words">
            {formatInline(single)}
          </p>
        )
      })}
    </div>
  )
}
