import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { springSnappy, springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import type { Weights } from '../lib/mechanisms'
import { targetMatch } from '../lib/signal'
import {
  LAYING_WEIGHTS,
  N_SAMPLES,
  N_SIMS,
  SITTING_WEIGHTS,
  SPLIT,
  buildSimTrace,
  lerpWeights,
  postureTrace,
  type PosturePhase,
  type SimOutcome,
} from '../lib/projection'

const W = 1000
const H = 220
const PAD_Y = 0.1

const NO_OUTCOMES: SimOutcome[] = []

type PostureChartProps = {
  posture: PosturePhase
  outcomes: SimOutcome[]
  phase: number
  /** 0 = every outcome collapsed onto the median, 1 = full simulated range */
  spread: number
  highlight: number | null
  showBand: boolean
  onHighlight: (i: number | null) => void
  /**
   * Live mechanism mix. In sitting this is the destination of the laying →
   * model morph; `fit` is how far along that morph has travelled.
   */
  weights?: Weights
  /** 0 = still the laying recording, 1 = the live model mix. */
  fit?: number
}

const COPY: Record<PosturePhase, { left: string; right?: string; note: string }> = {
  laying: {
    left: 'Laying — resting baseline',
    note: 'Resting clinical recording. Press Sitting to see the calibrated signal.',
  },
  sitting: {
    left: 'Laying vs sitting',
    note: '',
  },
  standing: {
    left: 'Sitting (calibrated)',
    right: 'Standing — simulated range',
    note: 'The standing prediction is always shown as a range — never a single line.',
  },
}

function LegendLine({
  color,
  width,
  opacity = 1,
  children,
}: {
  color: string
  width: number
  opacity?: number
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <svg width="20" height="6" viewBox="0 0 20 6" aria-hidden>
        <line
          x1="0"
          y1="3"
          x2="20"
          y2="3"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          opacity={opacity}
        />
      </svg>
      {children}
    </span>
  )
}

export function PostureChart({
  posture,
  outcomes,
  phase,
  spread,
  highlight,
  showBand,
  onHighlight,
  weights = SITTING_WEIGHTS,
  fit = 0,
}: PostureChartProps) {
  const isStanding = posture === 'standing'
  const isResting = posture === 'laying'
  const isSitting = posture === 'sitting'
  const showModel = isSitting && fit > 0.5

  // Resting is held still — the baseline reads as a calm reference, not a
  // live recording.
  const activePhase = isResting ? 0 : phase

  // Only the standing phase pays for 64 simulated traces.
  const simOutcomes = isStanding ? outcomes : NO_OUTCOMES

  const rawTraces = useMemo(
    () => simOutcomes.map((o) => buildSimTrace(o, activePhase)),
    [simOutcomes, activePhase],
  )

  const modelWeights = isSitting
    ? lerpWeights(LAYING_WEIGHTS, weights, fit)
    : isResting
      ? LAYING_WEIGHTS
      : SITTING_WEIGHTS

  const singleTrace = useMemo(
    () => postureTrace(modelWeights, activePhase),
    [modelWeights, activePhase],
  )

  const targetRef = useMemo(
    () => (isSitting ? postureTrace(SITTING_WEIGHTS, activePhase) : null),
    [isSitting, activePhase],
  )
  const match = useMemo(
    () => (isSitting ? targetMatch(modelWeights) : 0),
    [isSitting, modelWeights],
  )

  const layingExtent = useMemo(
    () => (isSitting ? postureTrace(LAYING_WEIGHTS, activePhase) : null),
    [isSitting, activePhase],
  )

  const medianTrace = useMemo(() => {
    if (rawTraces.length === 0) return singleTrace
    const column = new Array<number>(rawTraces.length)
    return Array.from({ length: N_SAMPLES }, (_, i) => {
      for (let k = 0; k < rawTraces.length; k++) column[k] = rawTraces[k][i]
      column.sort((a, b) => a - b)
      return column[Math.floor(column.length / 2)]
    })
  }, [rawTraces, singleTrace])

  // Fan the outcomes out from the median — this is what makes the band grow.
  const traces = useMemo(
    () =>
      rawTraces.map((trace) =>
        trace.map((v, i) => medianTrace[i] + spread * (v - medianTrace[i])),
      ),
    [rawTraces, medianTrace, spread],
  )

  const envelope = useMemo(() => {
    const mins = new Array<number>(N_SAMPLES).fill(Infinity)
    const maxs = new Array<number>(N_SAMPLES).fill(-Infinity)
    for (const trace of traces) {
      for (let i = 0; i < N_SAMPLES; i++) {
        if (trace[i] < mins[i]) mins[i] = trace[i]
        if (trace[i] > maxs[i]) maxs[i] = trace[i]
      }
    }
    return { mins, maxs }
  }, [traces])

  // Scale is fixed to the fully-spread envelope so the band grows into a
  // stable frame instead of the axis rescaling underneath it.
  const domain = useMemo(() => {
    const source =
      rawTraces.length > 0
        ? rawTraces
        : isSitting
          ? [layingExtent!, targetRef!]
          : [singleTrace]
    let min = Infinity
    let max = -Infinity
    for (const trace of source) {
      for (const v of trace) {
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    return { min, max, span: max - min || 1 }
  }, [rawTraces, singleTrace, isSitting, layingExtent, targetRef])

  const usableH = H * (1 - PAD_Y * 2)
  const yToSvg = (v: number) =>
    H * PAD_Y + (1 - (v - domain.min) / domain.span) * usableH
  const xAt = (i: number) => (i / (N_SAMPLES - 1)) * W

  const toPath = (samples: number[]) =>
    samples
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yToSvg(v).toFixed(1)}`)
      .join(' ')

  const bandPath = (() => {
    if (traces.length === 0) return ''
    let d = ''
    for (let i = 0; i < N_SAMPLES; i++) {
      d += `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yToSvg(envelope.maxs[i]).toFixed(1)}`
    }
    for (let i = N_SAMPLES - 1; i >= 0; i--) {
      d += `L${xAt(i).toFixed(1)} ${yToSvg(envelope.mins[i]).toFixed(1)}`
    }
    return `${d} Z`
  })()

  const splitX = SPLIT * W
  const hasEnvelope = traces.length > 0
  const rangeTop = hasEnvelope ? yToSvg(envelope.maxs[N_SAMPLES - 1]) : 0
  const rangeBottom = hasEnvelope ? yToSvg(envelope.mins[N_SAMPLES - 1]) : 0
  const copy = COPY[posture]

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-cream ring-1 ring-blush/60">
      {/* Zone labels */}
      <div className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-center px-6 pt-4 text-xs font-semibold tracking-[0.16em] text-charcoal/35 uppercase">
        <span style={{ width: isStanding ? `${SPLIT * 100}%` : '100%' }}>{copy.left}</span>
        {copy.right && <span className="flex-1 text-right">{copy.right}</span>}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full md:h-72"
        preserveAspectRatio="none"
        aria-label={
          isStanding
            ? 'Projection chart: sitting baseline widening into a simulated standing range'
            : `${copy.left} signal trace`
        }
        role="img"
      >
        <defs>
          {/* Hatch keeps the band legible without relying on colour alone */}
          <pattern
            id="band-hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="8" height="8" fill={UI.stone} opacity="0.1" />
            <line x1="0" y1="0" x2="0" y2="8" stroke={UI.stone} strokeWidth="1.6" opacity="0.22" />
          </pattern>
        </defs>

        {/* Sitting shading */}
        <motion.rect
          x={0}
          y={0}
          width={isStanding ? splitX : W}
          height={H}
          fill={posture === 'laying' ? UI.charcoal : UI.sageDeep}
          animate={{ opacity: 0.04 }}
          transition={springSoft}
        />

        {/* Transition marker */}
        <motion.line
          x1={splitX}
          y1={8}
          x2={splitX}
          y2={H - 8}
          stroke={UI.charcoal}
          strokeWidth={1.2}
          strokeDasharray="5 4"
          animate={{ opacity: isStanding ? 0.25 : 0 }}
          transition={springSoft}
        />

        {/* Uncertainty band — kept mounted so the per-frame `d` updates can't
            interrupt a fade and turn it into a hard cut */}
        <motion.path
          d={bandPath}
          fill="url(#band-hatch)"
          stroke={UI.stone}
          strokeWidth={0.8}
          strokeOpacity={0.3}
          initial={{ opacity: 0 }}
          animate={{ opacity: showBand && hasEnvelope ? 1 : 0 }}
          transition={springSoft}
        />

        {/* Individual simulation traces */}
        {traces.map((trace, i) => {
          const isHighlighted = highlight === i
          const isDimmed = highlight !== null && !isHighlighted
          return (
            <motion.path
              key={simOutcomes[i].id}
              d={toPath(trace)}
              fill="none"
              stroke={UI.stone}
              strokeLinecap="round"
              initial={false}
              animate={{
                opacity: isDimmed ? 0.04 : isHighlighted ? 0.95 : 0.16,
                strokeWidth: isHighlighted ? 2.2 : 0.9,
              }}
              transition={springSnappy}
              onMouseEnter={() => onHighlight(i)}
              onMouseLeave={() => onHighlight(null)}
            />
          )
        })}

        {/* Seated target — always present in sitting, never replaced */}
        {targetRef && (
          <motion.path
            d={toPath(targetRef)}
            fill="none"
            stroke={UI.blushDeep}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            transition={springSoft}
          />
        )}

        {/* Laying recording, morphing into the model as `fit` travels 0 → 1 */}
        <motion.path
          d={toPath(medianTrace)}
          fill="none"
          stroke={isSitting ? (showModel ? UI.sageDeep : UI.stone) : UI.charcoal}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        />

        {/* Standing range bracket — grows with the band */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: hasEnvelope && spread > 0.15 ? 0.7 : 0 }}
          transition={springSoft}
        >
          <line
            x1={W - 6}
            y1={rangeTop}
            x2={W - 6}
            y2={rangeBottom}
            stroke={UI.stone}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <line
            x1={W - 14}
            y1={rangeTop}
            x2={W - 6}
            y2={rangeTop}
            stroke={UI.stone}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={W - 14}
            y1={rangeBottom}
            x2={W - 6}
            y2={rangeBottom}
            stroke={UI.stone}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </motion.g>

        {(isResting || (isSitting && showModel) || isStanding) && (
        <text
          x={12}
          y={H - 10}
          fontSize={9}
          fill={isResting ? UI.charcoal : UI.sageDeep}
          fontWeight={600}
          opacity={0.6}
        >
          {isResting ? 'Resting' : isSitting ? `${match.toFixed(0)}% match` : 'Baseline'}
        </text>
        )}
        {isStanding && (
          <text
            x={splitX + 10}
            y={H - 10}
            fontSize={9}
            fill={UI.stone}
            fontWeight={600}
            opacity={0.7}
          >
            {N_SIMS} simulated outcomes
          </text>
        )}
      </svg>

      <div className="flex items-center gap-2 border-t border-blush/40 px-6 py-3">
        {!isSitting && (
          <span className="text-xs text-charcoal/35 italic">{copy.note}</span>
        )}
        {isSitting && (
          <div className="flex shrink-0 items-center gap-3 text-xs text-charcoal/40">
            <LegendLine color={showModel ? UI.sageDeep : UI.stone} width={2.2}>
              {showModel ? 'Model' : 'Laying'}
            </LegendLine>
            <LegendLine color={UI.blushDeep} width={1.8}>
              Sitting
            </LegendLine>
          </div>
        )}
        {isStanding && (
          <div className="ml-auto flex items-center gap-3 text-xs text-charcoal/40">
            <span className="flex items-center gap-1.5">
              <svg width="20" height="6" viewBox="0 0 20 6" aria-hidden>
                <line
                  x1="0"
                  y1="3"
                  x2="20"
                  y2="3"
                  stroke={UI.charcoal}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              Median
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden>
                <rect width="20" height="8" rx="2" fill="url(#band-hatch)" />
              </svg>
              Range
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
