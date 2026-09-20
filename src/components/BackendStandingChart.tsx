import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { springSoft } from '../lib/motion'

const W = 1000
const H = 220
const PAD_X = 28
const PAD_Y = 22

type StandingEnvelope = {
  draws: number
  durationSeconds: number
  sourceRecordId: string
  sourceWindowIndex: number
  calibratedEnvelope: readonly number[]
  medianEnvelope: readonly number[]
  lowerEnvelope: readonly number[]
  upperEnvelope: readonly number[]
}

type BackendStandingChartProps = {
  data: StandingEnvelope
  showBand: boolean
}

export function BackendStandingChart({ data, showBand }: BackendStandingChartProps) {
  const geometry = useMemo(() => {
    const all = [
      ...data.calibratedEnvelope,
      ...data.medianEnvelope,
      ...data.lowerEnvelope,
      ...data.upperEnvelope,
    ]
    const minimum = Math.min(...all)
    const maximum = Math.max(...all)
    const padding = (maximum - minimum || 1) * 0.08
    const domainMin = minimum - padding
    const domainMax = maximum + padding
    const domainSpan = domainMax - domainMin
    const count = data.medianEnvelope.length

    const xAt = (index: number) =>
      PAD_X + (index / Math.max(1, count - 1)) * (W - PAD_X * 2)
    const yAt = (value: number) =>
      PAD_Y + (1 - (value - domainMin) / domainSpan) * (H - PAD_Y * 2)
    const path = (values: readonly number[]) =>
      values
        .map(
          (value, index) =>
            `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`,
        )
        .join(' ')

    let band = path(data.upperEnvelope)
    for (let index = data.lowerEnvelope.length - 1; index >= 0; index -= 1) {
      band += `L${xAt(index).toFixed(2)} ${yAt(data.lowerEnvelope[index]).toFixed(2)}`
    }

    return {
      baseline: path(data.calibratedEnvelope),
      median: path(data.medianEnvelope),
      band: `${band} Z`,
    }
  }, [data])

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-cream ring-1 ring-blush/60">
      <div className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-center justify-between px-6 pt-4 text-xs font-semibold tracking-[0.16em] text-charcoal/35 uppercase">
        <span>60-second representative envelope</span>
        <span>Backend standing projection</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full md:h-72"
        preserveAspectRatio="none"
        role="img"
        aria-label="Backend standing projection showing the calibrated baseline, projected median, and 95 percent simulation band"
      >
        <motion.path
          d={geometry.band}
          fill="#b8d4e8"
          initial={false}
          animate={{ opacity: showBand ? 0.72 : 0 }}
          transition={springSoft}
        />
        <path
          d={geometry.baseline}
          fill="none"
          stroke="#1f77b4"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={geometry.median}
          fill="none"
          stroke="#ff7f0e"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x={PAD_X} y={H - 7} fontSize={9} fill="#3a3532" opacity={0.5}>
          0 s
        </text>
        <text x={W - PAD_X} y={H - 7} textAnchor="end" fontSize={9} fill="#3a3532" opacity={0.5}>
          {data.durationSeconds.toFixed(0)} s
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-blush/40 px-6 py-3 text-xs text-charcoal/50">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-[#1f77b4]" />
          Calibrated baseline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-[#ff7f0e]" />
          Standing median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded bg-[#b8d4e8]" />
          95% simulation band
        </span>
        <span className="ml-auto">
          {data.draws} draws · {data.sourceRecordId} · window {data.sourceWindowIndex + 1}
        </span>
      </div>
    </div>
  )
}
