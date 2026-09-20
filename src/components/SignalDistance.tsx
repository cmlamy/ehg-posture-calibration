import { memo } from 'react'
import { motion } from 'framer-motion'
import { springSnappy, springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { SpringNumber } from './SpringNumber'

type SignalDistanceProps = {
  mmd: number
  history: number[]
  /** Narrow stacked card, for sitting beside the posture chart. */
  compact?: boolean
}

export const SignalDistance = memo(function SignalDistance({
  mmd,
  history,
  compact = false,
}: SignalDistanceProps) {
  const prev = history.length > 1 ? history[history.length - 2] : mmd
  const delta = mmd - prev
  const closer = delta < -0.002
  const farther = delta > 0.002

  const w = compact ? 148 : 160
  const h = compact ? 40 : 36
  const max = Math.max(...history, 0.05)
  const points = history
    .map((v, i) => {
      const x = history.length === 1 ? 0 : (i / (history.length - 1)) * w
      const y = h - (v / max) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  const trend = (
    <motion.span
      key={closer ? 'down' : farther ? 'up' : 'flat'}
      initial={{ y: closer ? -2 : 2, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springSnappy}
      className="inline-flex items-center gap-1 text-sm text-charcoal/80"
    >
      <span aria-hidden="true">{closer ? '↓' : farther ? '↑' : '→'}</span>
      {closer ? 'closer' : farther ? 'farther' : 'steady'}
    </motion.span>
  )

  const spark = (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={compact ? 'h-10 w-full' : 'mb-1 ml-auto h-9 w-40'}
      role="img"
      aria-label="MMD history sparkline"
    >
      <motion.polyline
        points={points}
        fill="none"
        stroke={UI.sageDeep}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: 1 }}
        transition={springSoft}
      />
    </svg>
  )

  if (compact) {
    return (
      <div className="rounded-3xl bg-cream/80 p-5 ring-1 ring-blush/80">
        <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
          Signal Distance
        </p>
        <p className="mt-3 font-display text-4xl leading-none text-ink tabular-nums">
          <SpringNumber value={mmd} decimals={3} />
        </p>
        <div className="mt-2">{trend}</div>
        <div className="mt-4">{spark}</div>
        <p className="mt-3 text-xs leading-relaxed text-charcoal/60">
          Lower is closer to the target mix.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-cream/80 p-6 ring-1 ring-blush/80">
      <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
        Signal Distance
      </p>
      <div className="mt-2 flex items-end gap-4">
        <p className="font-display text-5xl leading-none text-ink tabular-nums">
          <SpringNumber value={mmd} decimals={3} />
        </p>
        <motion.span
          key={closer ? 'down' : farther ? 'up' : 'flat'}
          initial={{ y: closer ? -2 : 2, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={springSnappy}
          className="mb-1 inline-flex items-center gap-1 text-sm text-charcoal/80"
        >
          <span aria-hidden="true">{closer ? '↓' : farther ? '↑' : '→'}</span>
          {closer ? 'closer' : farther ? 'farther' : 'steady'}
        </motion.span>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="mb-1 ml-auto h-9 w-40"
          role="img"
          aria-label="MMD history sparkline"
        >
          <motion.polyline
            points={points}
            fill="none"
            stroke={UI.sageDeep}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: 1 }}
            transition={springSoft}
          />
        </svg>
      </div>
      <p className="mt-3 text-sm text-charcoal/70">
        Lower means closer to the target distribution.
      </p>
    </div>
  )
})
