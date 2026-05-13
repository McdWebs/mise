import type { OrderStage } from '@mise/types'

export function fmtTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type TimerClass = '' | 'warn' | 'urgent'

export function timerClass(stage: OrderStage, seconds: number): TimerClass {
  if (stage === 'cooking' && seconds > 720) return 'urgent' // > 12 min
  if (stage === 'cooking' && seconds > 480) return 'warn'   // > 8 min
  if (stage === 'ready'   && seconds > 300) return 'urgent' // > 5 min at pass
  return ''
}

/** Elapsed seconds since a date string (ISO 8601) */
export function elapsedSeconds(since: string): number {
  return Math.floor((Date.now() - new Date(since).getTime()) / 1000)
}

/** Web Audio API ding — no external asset required */
export function playDing(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1046, ctx.currentTime)     // C6
    osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.08) // E6
    gain.gain.setValueAtTime(0.28, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.7)
    // Clean up after playback
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext not available (SSR / test env) — ignore
  }
}
