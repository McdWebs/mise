import React from 'react'

const PAPER  = '#FAF6F0'
const INK    = '#1A1612'
const INK5   = '#6A5E51'
const INK7   = '#9A8C7A'
const SAFFRON = '#D97706'

export type MascotPose      = 'hello' | 'listen' | 'thinking' | 'ready' | 'running' | 'wink' | 'sleep'
export type MascotTheme     = 'line' | 'saffron' | 'ink' | 'paper'
export type MascotAccessory = 'towel' | 'none'

export interface MascotProps {
  pose?:      MascotPose
  theme?:     MascotTheme
  size?:      number
  accessory?: MascotAccessory
}

function Cloche({ theme = 'line', lift = 0 }: { theme?: MascotTheme; lift?: number }) {
  const yOffset = -lift

  let domeFill    = 'none'
  let stroke      = INK
  let knobColor   = SAFFRON
  let rimColor    = SAFFRON
  let plateStroke = INK

  if (theme === 'saffron') {
    domeFill = SAFFRON; stroke = INK; knobColor = INK; rimColor = INK; plateStroke = INK
  } else if (theme === 'ink') {
    domeFill = INK; stroke = PAPER; knobColor = SAFFRON; rimColor = SAFFRON; plateStroke = INK
  } else if (theme === 'paper') {
    domeFill = PAPER; stroke = INK; knobColor = SAFFRON; rimColor = SAFFRON; plateStroke = PAPER
  }

  return (
    <g>
      <g transform={`translate(0 ${yOffset})`}>
        <circle cx="100" cy="40" r="7" fill={knobColor} />
        <line x1="100" y1="47" x2="100" y2="58" stroke={knobColor} strokeWidth="5" strokeLinecap="round" />
        <path
          d="M40 140 C 40 90, 65 58, 100 58 C 135 58, 160 90, 160 140 Z"
          fill={domeFill}
          stroke={stroke}
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
      </g>
      <line x1="32" y1="148" x2="168" y2="148" stroke={plateStroke} strokeWidth="5.5" strokeLinecap="round" />
      <line x1="54" y1="158" x2="146" y2="158" stroke={rimColor} strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

type EyeKind = 'dot' | 'happy' | 'closed' | 'up'

function Eye({ cx, cy, kind, color }: { cx: number; cy: number; kind: EyeKind; color: string }) {
  switch (kind) {
    case 'happy':
      return (
        <path
          d={`M${cx - 5} ${cy + 1} Q ${cx} ${cy - 4} ${cx + 5} ${cy + 1}`}
          stroke={color} strokeWidth="4" strokeLinecap="round" fill="none"
        />
      )
    case 'closed':
      return <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={color} strokeWidth="4" strokeLinecap="round" />
    case 'up':
      return <circle cx={cx} cy={cy - 1} r="2.6" fill={color} />
    default:
      return <circle cx={cx} cy={cy} r="2.8" fill={color} />
  }
}

type MouthKind = 'smile' | 'open' | 'small' | 'neutral'

interface ExpressionCfg { left: EyeKind; right: EyeKind; mouth: MouthKind }

const EXPRESSION_MAP: Record<MascotPose, ExpressionCfg> = {
  hello:    { left: 'dot',    right: 'dot',    mouth: 'smile'   },
  listen:   { left: 'dot',    right: 'dot',    mouth: 'neutral' },
  thinking: { left: 'up',     right: 'up',     mouth: 'small'   },
  ready:    { left: 'happy',  right: 'happy',  mouth: 'smile'   },
  running:  { left: 'dot',    right: 'dot',    mouth: 'open'    },
  sleep:    { left: 'closed', right: 'closed', mouth: 'small'   },
  wink:     { left: 'dot',    right: 'closed', mouth: 'smile'   },
}

function Face({ expression = 'hello', color = INK, lift = 0 }: { expression?: MascotPose; color?: string; lift?: number }) {
  const y    = -lift
  const eyeY = 108
  const mouthY = 124
  const cfg  = EXPRESSION_MAP[expression] ?? EXPRESSION_MAP.hello

  const mouthEl = (() => {
    switch (cfg.mouth) {
      case 'smile':
        return <path d={`M93 ${mouthY} Q 100 ${mouthY + 6} 107 ${mouthY}`} stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      case 'open':
        return <ellipse cx="100" cy={mouthY + 2} rx="3.5" ry="4" fill={color} />
      case 'small':
        return <line x1="96" y1={mouthY + 2} x2="104" y2={mouthY + 2} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      default:
        return <line x1="94" y1={mouthY + 2} x2="106" y2={mouthY + 2} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
    }
  })()

  return (
    <g transform={`translate(0 ${y})`}>
      <Eye cx={86}  cy={eyeY} kind={cfg.left}  color={color} />
      <Eye cx={114} cy={eyeY} kind={cfg.right} color={color} />
      {mouthEl}
    </g>
  )
}

function WavingArm({ color = INK }: { color?: string }) {
  return (
    <g>
      <path d="M156 118 Q 174 110 178 92" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="180" cy="88" r="5" fill={color} />
    </g>
  )
}

function TeaTowel({ color = SAFFRON }: { color?: string }) {
  return (
    <g>
      <rect x="22" y="118" width="22" height="22" rx="2" fill={color} stroke={INK} strokeWidth="3" />
      <line x1="26" y1="125" x2="40" y2="125" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </g>
  )
}

function SteamWisps({ color = INK5 }: { color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <path d="M80 30 Q 78 22 82 14" />
      <path d="M100 22 Q 98 14 102 6" />
      <path d="M120 30 Q 118 22 122 14" />
    </g>
  )
}

function ThoughtDots({ color = INK }: { color?: string }) {
  return (
    <g fill={color}>
      <circle cx="148" cy="60" r="2.5" />
      <circle cx="158" cy="50" r="3.5" />
      <circle cx="172" cy="38" r="5" />
    </g>
  )
}

function Sparkles({ color = SAFFRON }: { color?: string }) {
  const star = (cx: number, cy: number, r: number) => (
    <path
      key={`${cx}-${cy}`}
      d={`M${cx} ${cy - r} L${cx + r * 0.3} ${cy - r * 0.3} L${cx + r} ${cy} L${cx + r * 0.3} ${cy + r * 0.3} L${cx} ${cy + r} L${cx - r * 0.3} ${cy + r * 0.3} L${cx - r} ${cy} L${cx - r * 0.3} ${cy - r * 0.3} Z`}
      fill={color}
    />
  )
  return <g>{star(38, 56, 7)}{star(170, 76, 5)}{star(48, 90, 4)}</g>
}

function SpeedLines({ color = INK5 }: { color?: string }) {
  return (
    <g stroke={color} strokeWidth="3.5" strokeLinecap="round">
      <line x1="14" y1="86"  x2="32" y2="86"  />
      <line x1="10" y1="108" x2="34" y2="108" />
      <line x1="18" y1="128" x2="34" y2="128" />
    </g>
  )
}

function Zzz({ color = INK5 }: { color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M152 70 L168 70 L152 86 L168 86" />
      <path d="M168 50 L182 50 L168 62 L182 62" />
    </g>
  )
}

function Plate() {
  return (
    <g>
      <ellipse cx="100" cy="146" rx="22" ry="3" fill={INK} opacity="0.18" />
      <path d="M82 146 Q 100 130 118 146 Z" fill={SAFFRON} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g fill="none" stroke={INK5} strokeWidth="2.5" strokeLinecap="round">
        <path d="M92 128 Q 90 122 94 116" />
        <path d="M104 128 Q 102 122 106 116" />
      </g>
    </g>
  )
}

function OrderTicket({ color = INK }: { color?: string }) {
  return (
    <g>
      <rect x="120" y="118" width="34" height="28" fill={PAPER} stroke={color} strokeWidth="3" />
      <line x1="126" y1="126" x2="148" y2="126" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="126" y1="132" x2="144" y2="132" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="126" y1="138" x2="140" y2="138" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

export function Mascot({ pose = 'hello', theme = 'line', size = 240, accessory = 'towel' }: MascotProps) {
  const faceColor = theme === 'ink' ? PAPER : INK
  const armColor  = theme === 'ink' ? PAPER : INK
  const lift      = pose === 'ready' ? 16 : 0

  const showTowel    = accessory === 'towel' && pose !== 'running' && pose !== 'ready'
  const showWaving   = pose === 'hello'
  const showSteam    = pose === 'listen' || pose === 'thinking'
  const showDots     = pose === 'thinking'
  const showSparkles = pose === 'ready'
  const showSpeed    = pose === 'running'
  const showZ        = pose === 'sleep'
  const showPlate    = pose === 'ready'
  const showTicket   = pose === 'running'

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {showSteam    && <SteamWisps  color={theme === 'ink' ? INK7 : INK5} />}
      {showSparkles && <Sparkles />}
      {showDots     && <ThoughtDots color={theme === 'ink' ? PAPER : INK} />}
      {showSpeed    && <SpeedLines />}
      {showZ        && <Zzz         color={theme === 'ink' ? INK7 : INK5} />}

      <Cloche theme={theme} lift={lift} />

      {showPlate  && <Plate />}

      <Face expression={pose} color={faceColor} lift={lift} />

      {showTowel  && <TeaTowel />}
      {showWaving && <WavingArm color={armColor} />}
      {showTicket && <OrderTicket />}
    </svg>
  )
}
