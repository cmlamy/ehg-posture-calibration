import { memo } from 'react'
import { motion } from 'framer-motion'
import { MECHANISMS } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import type { CompositionDelta } from '../lib/signal'
import { MechanismIcon } from './MechanismIcon'
import { SpringNumber } from './SpringNumber'

type CalibrationShiftProps = {
  deltas: CompositionDelta[]
  /** Percentage points of the mix that were redistributed */
  shift: number
  /** Composition match to target, 0–100%, before calibration */
  matchBefore: number
  /** Composition match to target, 0–100%, after calibration */
  matchAfter: number
  /** Signal distance before and after */
  mmdBefore: number
  mmdAfter: number
  onReanchor: () => void
  onReset: () => void
  isAnchored: boolean
}

/** Horizontal stacked bar of composition shares. */
function ShareBar({
  deltas,
  pick,
  label,
}: {
  deltas: CompositionDelta[]
  pick: (d: CompositionDelta) => number
  label: string
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
        {label}
      </p>
      <div
        className="flex h-6 overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${deltas
          .map((d) => `${MECHANISMS[d.id].short} ${pick(d).toFixed(0)}%`)
          .join(', ')}`}
      >
        {deltas.map((d) => (
          <motion.div
            key={d.id}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: MECHANISMS[d.id].color }}
            animate={{ width: `${pick(d)}%` }}
            transition={springSoft}
          />
        ))}
      </div>
    </div>
  )
}

/** One metric readout. */
function Metric({
  label,
  children,
  sub,
}: {
  label: string
  children: React.ReactNode
  sub: string
}) {
  return (
    <div className="rounded-2xl bg-ivory px-4 py-3">
      <p className="text-[10px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-medium text-ink">{children}</p>
      <p className="mt-0.5 text-xs leading-snug text-charcoal/45">{sub}</p>
    </div>
  )
}

export const CalibrationShift = memo(function CalibrationShift({
  deltas,
  shift,
  matchBefore,
  matchAfter,
  mmdBefore,
  mmdAfter,
  onReanchor,
  onReset,
  isAnchored,
}: CalibrationShiftProps) {
  const matchGain = matchAfter - matchBefore
  const mmdDrop = mmdBefore > 0 ? ((mmdBefore - mmdAfter) / mmdBefore) * 100 : 0
  // Widest single-mechanism move sets the scale for the delta bars.
  const maxAbs = Math.max(4, ...deltas.map((d) => Math.abs(d.delta)))

  return (
    <div className="rounded-3xl bg-cream/80 p-6 ring-1 ring-blush/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
            Calibration shift
          </p>
          <p className="mt-1 font-display text-2xl text-ink">
            Baseline → calibrated composition
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReanchor}
            className="rounded-full bg-ivory px-3 py-1.5 text-xs font-medium text-charcoal/70"
          >
            Set current as baseline
          </button>
          {isAnchored && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-full bg-ivory px-3 py-1.5 text-xs font-medium text-charcoal/70"
            >
              Reset to clinical
            </button>
          )}
        </div>
      </div>

      {/* Before / after stacked bars */}
      <div className="mt-5 space-y-3">
        <ShareBar deltas={deltas} pick={(d) => d.before} label="Before — baseline mix" />
        <ShareBar deltas={deltas} pick={(d) => d.after} label="After — calibrated mix" />
      </div>

      {/* Per-mechanism change table */}
      <table className="mt-5 w-full border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr className="text-[10px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
            <th scope="col" className="text-left font-medium">
              Mechanism
            </th>
            <th scope="col" className="w-16 text-right font-medium">
              Before
            </th>
            <th scope="col" className="w-16 text-right font-medium">
              After
            </th>
            <th scope="col" className="w-20 text-right font-medium">
              Change
            </th>
            <th scope="col" className="w-28 text-left font-medium">
              <span className="sr-only">Change magnitude</span>
            </th>
            <th scope="col" className="w-20 text-right font-medium">
              To target
            </th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => {
            const m = MECHANISMS[d.id]
            const up = d.delta >= 0
            const width = (Math.abs(d.delta) / maxAbs) * 50
            return (
              <tr key={d.id}>
                <td className="py-1">
                  <span className="flex items-center gap-2">
                    <MechanismIcon id={d.id} className="h-4 w-4 shrink-0" />
                    <span className="truncate text-charcoal">{m.short}</span>
                  </span>
                </td>
                <td className="text-right font-mono text-xs text-charcoal/45">
                  {d.before.toFixed(1)}%
                </td>
                <td className="text-right font-mono text-xs text-charcoal">
                  <SpringNumber value={d.after} decimals={1} suffix="%" />
                </td>
                <td
                  className="text-right font-mono text-xs font-medium"
                  style={{ color: Math.abs(d.delta) < 0.05 ? UI.stoneSoft : m.color }}
                >
                  {up ? '+' : '−'}
                  {Math.abs(d.delta).toFixed(1)}
                </td>
                {/* Diverging bar: left of centre is a decrease, right an increase */}
                <td>
                  <div className="relative h-2.5 w-full rounded-full bg-blush/40">
                    <span
                      className="absolute top-0 bottom-0 w-px bg-charcoal/25"
                      style={{ left: '50%' }}
                    />
                    <motion.span
                      className="absolute top-0.5 bottom-0.5 rounded-full"
                      style={{ background: m.color }}
                      animate={{
                        left: up ? '50%' : `${50 - width}%`,
                        width: `${width}%`,
                      }}
                      transition={springSoft}
                    />
                  </div>
                </td>
                <td className="text-right font-mono text-xs text-charcoal/45">
                  {d.gap < 0.05 ? 'match' : `${d.gap.toFixed(1)} pp`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Summary metrics */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Composition shift"
          sub="share of the mix redistributed from baseline"
        >
          <SpringNumber value={shift} decimals={1} suffix=" pp" />
        </Metric>
        <Metric
          label="Target match"
          sub={`${matchGain >= 0 ? '+' : '−'}${Math.abs(matchGain).toFixed(1)} pp vs baseline (${matchBefore.toFixed(0)}%)`}
        >
          <SpringNumber value={matchAfter} decimals={1} suffix="%" />
        </Metric>
        <Metric
          label="Signal distance"
          sub={`MMD ${mmdBefore.toFixed(3)} → ${mmdAfter.toFixed(3)}`}
        >
          <span style={{ color: mmdDrop >= 0 ? UI.sageDeep : UI.stone }}>
            {mmdDrop >= 0 ? '↓' : '↑'} <SpringNumber value={Math.abs(mmdDrop)} decimals={0} suffix="%" />
          </span>
        </Metric>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-charcoal/45">
        Composition shift measures how far the mix moved; target match measures whether
        it moved to the right place. A large shift with a low match means the
        calibration is working hard in the wrong direction.
      </p>
    </div>
  )
})
