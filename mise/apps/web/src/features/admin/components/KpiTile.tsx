interface SparkBarProps {
  data: number[]
}

function SparkBar({ data }: SparkBarProps) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-6 mt-2">
      {data.map((v, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-[1px] ${i === data.length - 1 ? 'bg-saffron' : 'bg-paper-3'}`}
          style={{ height: `${Math.max(2, Math.round((v / max) * 22))}px` }}
        />
      ))}
    </div>
  )
}

interface KpiTileProps {
  label: string
  value: string
  delta: string
  deltaDown?: boolean
  spark: number[]
}

export function KpiTile({ label, value, delta, deltaDown, spark }: KpiTileProps) {
  return (
    <div className="p-4 bg-paper border border-paper-3 rounded-3 flex flex-col gap-1">
      <div className="text-overline text-ink-6 uppercase tracking-widest">{label}</div>
      <div className="font-display text-[34px] font-[500] text-ink leading-none tracking-[-0.015em] font-optical">
        {value}
      </div>
      <div className={`font-mono text-[11px] font-semibold mt-0.5 ${deltaDown ? 'text-ember' : 'text-herb-2'}`}>
        {delta}
      </div>
      <SparkBar data={spark} />
    </div>
  )
}
