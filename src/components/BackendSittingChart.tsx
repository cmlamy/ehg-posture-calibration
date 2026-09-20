import { useMemo } from 'react'
import { UI } from '../lib/palette'

const W = 1000
const H = 300
const PAD_X = 28
const PAD_Y = 30
const DISPLAY_SECONDS = 12
const DISPLAY_START_SECONDS = 12

type SittingDemo = {
  fs: number
  durationSeconds: number
  sourceRecordId: string
  sourceWindowIndex: number
  visualReferenceCorrelation: number
  lyingTrace: readonly number[]
  calibratedTrace: readonly number[]
  seatedReferenceTrace: readonly number[]
}

type BackendSittingChartProps = {
  data: SittingDemo
  fit: number
  mmd2ReductionPercent: number
}

export function BackendSittingChart({
  data,
  fit,
  mmd2ReductionPercent,
}: BackendSittingChartProps) {
  const geometry = useMemo(() => {
    const displayStart = Math.min(
      data.lyingTrace.length - 1,
      Math.round(data.fs * DISPLAY_START_SECONDS),
    )
    const displayCount = Math.min(
      data.lyingTrace.length - displayStart,
      Math.round(data.fs * DISPLAY_SECONDS),
    )
    const displayEnd = displayStart + displayCount
    const lyingTrace = data.lyingTrace.slice(displayStart, displayEnd)
    const calibratedTrace = data.calibratedTrace.slice(displayStart, displayEnd)
    const seatedReferenceTrace = data.seatedReferenceTrace.slice(displayStart, displayEnd)
    const all = [...lyingTrace, ...calibratedTrace, ...seatedReferenceTrace]
    const minimum = Math.min(...all)
    const maximum = Math.max(...all)
    const padding = (maximum - minimum || 1) * 0.08
    const domainMin = minimum - padding
    const domainSpan = maximum + padding - domainMin
    const count = lyingTrace.length
    const progress = Math.max(0, Math.min(1, fit))

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
    const model = lyingTrace.map(
      (value, index) => value + (calibratedTrace[index] - value) * progress,
    )

    return {
      seatedReference: path(seatedReferenceTrace),
      model: path(model),
      durationSeconds: (displayCount - 1) / data.fs,
    }
  }, [data, fit])

  const fitted = fit > 0.5

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-cream ring-1 ring-blush/60">
      <div className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-center justify-between px-6 pt-4 text-xs font-semibold tracking-[0.16em] text-charcoal/35 uppercase">
        <span>Real held-out lying window</span>
        <span>Sitting calibration</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-72 w-full md:h-96"
        preserveAspectRatio="none"
        role="img"
        aria-label="Real backend lying signal, frontend seated reference, and calibrated model signal"
      >
        <defs>
          <clipPath id="sitting-chart-clip">
            <rect x={PAD_X} y={PAD_Y} width={W - PAD_X * 2} height={H - PAD_Y * 2} rx="5" />
          </clipPath>
        </defs>
        <g clipPath="url(#sitting-chart-clip)">
          <path
            d={geometry.seatedReference}
            fill="none"
            stroke={UI.blushDeep}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <path
            d={geometry.model}
            fill="none"
            stroke={fitted ? UI.sageDeep : UI.stone}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        </g>
        <text x={PAD_X} y={H - 7} fontSize={9} fill={UI.charcoal} opacity={0.5}>
          0 s
        </text>
        <text x={W - PAD_X} y={H - 7} textAnchor="end" fontSize={9} fill={UI.charcoal} opacity={0.5}>
          {geometry.durationSeconds.toFixed(0)} s
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-blush/40 px-6 py-3 text-xs text-charcoal/50">
        <span className="flex items-center gap-1.5">
          <span className={`h-0.5 w-5 rounded ${fitted ? 'bg-sage-deep' : 'bg-stone'}`} />
          {fitted
            ? `Calibrated lying · ${mmd2ReductionPercent.toFixed(1)}% MMD² reduction`
            : 'Lying data'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-blush-deep" />
          Sitting baseline
        </span>
      </div>
    </div>
  )
}
