import { pathFromSamples } from '../lib/signal'

type WaveformProps = {
  samples: number[]
  color: string
  dash?: string
  height?: number
  strokeWidth?: number
  width?: number
  className?: string
}

export function Waveform({
  samples,
  color,
  dash = '',
  height = 120,
  strokeWidth = 2.2,
  width = 1000,
  className = 'h-full w-full',
}: WaveformProps) {
  const d = pathFromSamples(samples, width, height)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash || undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
