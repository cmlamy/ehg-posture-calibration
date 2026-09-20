import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, useMotionValueEvent, useSpring } from 'framer-motion'
import { PostureChart } from '../components/PostureChart'
import { SimulationControls } from '../components/SimulationControls'
import { Waveform } from '../components/Waveform'
import { SpringNumber } from '../components/SpringNumber'
import { TARGET_WEIGHTS } from '../lib/mechanisms'
import { springSoft, springSpread } from '../lib/motion'
import {
  N_SIMS,
  POSTURAL_FACTORS,
  buildSimTrace,
  generateOutcomes,
  standingRatio,
  type SimOutcome,
} from '../lib/projection'
import { buildTrace, mixSample, PHASE_RATE } from '../lib/signal'

// ─── Literature range cards ──────────────────────────────────────────────────

const FACTOR_DOMAIN = {
  min: Math.min(...POSTURAL_FACTORS.map((f) => f.rangeLow)),
  max: Math.max(...POSTURAL_FACTORS.map((f) => f.rangeHigh)),
}
const FACTOR_SPAN = FACTOR_DOMAIN.max - FACTOR_DOMAIN.min

function factorPct(value: number) {
  return ((value - FACTOR_DOMAIN.min) / FACTOR_SPAN) * 100
}

function LiteratureCard({
  factor,
  index,
}: {
  factor: (typeof POSTURAL_FACTORS)[number]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px 0px' })
  const { rangeLow: lo, rangeHigh: hi } = factor
  const left = factorPct(lo)
  const width = factorPct(hi) - left
  const direction = lo >= 0 ? 'increase' : hi <= 0 ? 'decrease' : 'mixed direction'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 4 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...springSoft, delay: index * 0.07 }}
      className="rounded-3xl bg-cream p-5 ring-1 ring-blush/60"
    >
      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-cream uppercase"
        style={{ background: factor.color }}
      >
        {factor.label}
      </span>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/65">{factor.description}</p>

      <div className="mt-4">
        <div className="mb-1 flex justify-between font-mono text-[10px] text-charcoal/40">
          <span>
            {lo > 0 ? '+' : ''}
            {Math.round(lo * 100)}%
          </span>
          <span>
            {hi > 0 ? '+' : ''}
            {Math.round(hi * 100)}%
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-blush/40">
          {/* Zero on the shared scale */}
          <div
            className="absolute top-0 bottom-0 w-px bg-charcoal/25"
            style={{ left: `${factorPct(0)}%` }}
            aria-hidden
          />
          <motion.div
            className="absolute top-0 bottom-0 rounded-full"
            style={{ background: factor.color, left: `${left}%`, opacity: 0.7 }}
            initial={{ width: 0 }}
            animate={inView ? { width: `${width}%` } : { width: 0 }}
            transition={{ ...springSoft, delay: 0.1 + index * 0.06 }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-charcoal/40">
          {direction} · literature range
        </p>
      </div>
    </motion.div>
  )
}

// ─── Standing range summary ──────────────────────────────────────────────────

function StandingRangeSummary({ ratios }: { ratios: number[] }) {
  const sorted = useMemo(() => [...ratios].sort((a, b) => a - b), [ratios])
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]

  const items = [
    { label: 'Lower bound', value: at(0.1), sub: '10th percentile', color: '#8a7f7a' },
    { label: 'Median', value: at(0.5), sub: '50th percentile', color: '#3a3532' },
    { label: 'Upper bound', value: at(0.9), sub: '90th percentile', color: '#8a7f7a' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl bg-cream px-4 py-4 text-center ring-1 ring-blush/60"
        >
          <p className="text-[10px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
            {item.label}
          </p>
          <p className="mt-1 font-display text-2xl font-medium" style={{ color: item.color }}>
            <SpringNumber value={item.value} decimals={2} suffix="×" />
          </p>
          <p className="mt-0.5 text-xs text-charcoal/40">{item.sub}</p>
          <p className="mt-0.5 text-xs text-charcoal/40">of seated amplitude</p>
        </div>
      ))}
    </div>
  )
}

// ─── Simulation trace browser ────────────────────────────────────────────────

function SimulationBrowser({
  outcomes,
  ratios,
  phase,
  highlight,
  setHighlight,
}: {
  outcomes: SimOutcome[]
  ratios: number[]
  phase: number
  highlight: number | null
  setHighlight: (i: number | null) => void
}) {
  const shown = outcomes.slice(0, 12)

  return (
    <div>
      <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
        Individual simulated outcomes — hover to highlight
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((outcome, i) => {
          const trace = buildSimTrace(outcome, phase)
          const isHL = highlight === i
          return (
            <motion.div
              key={outcome.id}
              animate={{ scale: isHL ? 1.01 : 1 }}
              transition={springSoft}
              onMouseEnter={() => setHighlight(i)}
              onMouseLeave={() => setHighlight(null)}
              className="cursor-pointer rounded-2xl px-2 py-2"
              style={{
                background: isHL ? 'color-mix(in srgb, #8a7f7a 10%, #faf6f0)' : '#faf6f0',
                boxShadow: isHL ? 'inset 0 0 0 1px #8a7f7a55' : 'inset 0 0 0 1px transparent',
              }}
            >
              <p className="mb-1 text-center font-mono text-[9px] text-charcoal/40">
                #{String(outcome.id + 1).padStart(2, '0')}
              </p>
              <div className="h-8">
                <Waveform
                  samples={trace}
                  color={isHL ? '#8a7f7a' : '#a09690'}
                  strokeWidth={1.2}
                  height={32}
                />
              </div>
              <p className="mt-1 text-center font-mono text-[8px] text-charcoal/35">
                {ratios[i].toFixed(2)}×
              </p>
            </motion.div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-charcoal/35">
        Showing 12 of {N_SIMS} outcomes · all contribute to the band above
      </p>
    </div>
  )
}

// ─── Projection page ──────────────────────────────────────────────────────────

export function Projection() {
  const [seed, setSeed] = useState(2718)
  const [phase, setPhase] = useState(0)
  const [running, setRunning] = useState(true)
  const [showBand, setShowBand] = useState(true)
  const [highlight, setHighlight] = useState<number | null>(null)

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      setPhase((p) => p + ((now - last) / 1000) * PHASE_RATE)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const outcomes = useMemo(() => generateOutcomes(seed), [seed])
  const ratios = useMemo(() => outcomes.map(standingRatio), [outcomes])

  // Spring that fans the outcomes out of the seated baseline into the full range.
  const spreadSpring = useSpring(0, springSpread)
  const [spread, setSpread] = useState(0)
  useMotionValueEvent(spreadSpring, 'change', setSpread)

  useEffect(() => {
    spreadSpring.jump(0)
    spreadSpring.set(1)
  }, [spreadSpring, seed])

  const reseed = () => setSeed(Math.floor(Math.random() * 99999))

  const seatedTrace = useMemo(
    () => buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase, 8),
    [phase],
  )

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Step 11
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            From seated
            <br className="hidden sm:block" /> to standing
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            The calibrated seated signal is projected to estimate standing EHG
            characteristics using literature-derived postural change ranges.
          </p>
        </motion.header>

        {/* Simulation controls */}
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.06 }}
        >
          <SimulationControls
            seed={seed}
            onReseed={reseed}
            running={running}
            onToggle={() => setRunning((r) => !r)}
            showBand={showBand}
            onToggleBand={() => setShowBand((b) => !b)}
          />
        </motion.div>

        {/* Main projection chart */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.1 }}
        >
          <PostureChart
            posture="standing"
            outcomes={outcomes}
            phase={phase}
            spread={spread}
            highlight={highlight}
            showBand={showBand}
            onHighlight={setHighlight}
          />
        </motion.div>

        {/* Never-a-single-line explainer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springSoft, delay: 0.18 }}
          className="flex items-start gap-4 rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ivory text-charcoal/40">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 6v4M7 4.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Why a band, not a line?</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
              Postural EHG change is driven by four physiological mechanisms that vary
              across individuals. Each of {N_SIMS} simulated outcomes samples independently
              from literature ranges for all four factors. Presenting the full envelope
              honestly communicates the uncertainty — no false precision. The dark median
              trace is the central tendency only.
            </p>
          </div>
        </motion.div>

        {/* Seated baseline snapshot */}
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.2 }}
          className="grid gap-4 sm:grid-cols-[1fr_2fr]"
        >
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
              Input — calibrated seated
            </p>
            <div className="rounded-3xl bg-cream px-5 py-4 ring-1 ring-blush/60">
              <div className="h-16">
                <Waveform samples={seatedTrace} color="#5f6b58" strokeWidth={2} height={64} />
              </div>
              <p className="mt-2 text-xs text-charcoal/40">
                Seating Half A · calibrated · 8-feature validated
              </p>
            </div>
          </div>
          <StandingRangeSummary ratios={ratios} />
        </motion.div>

        {/* Literature factors */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...springSoft, delay: 0.24 }}
            className="mb-4 text-xs font-semibold tracking-[0.2em] text-charcoal/40 uppercase"
          >
            Postural change factors — from literature
          </motion.p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POSTURAL_FACTORS.map((factor, i) => (
              <LiteratureCard key={factor.id} factor={factor} index={i} />
            ))}
          </div>
        </div>

        {/* Individual simulation browser */}
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.3 }}
          className="rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <SimulationBrowser
            outcomes={outcomes}
            ratios={ratios}
            phase={phase}
            highlight={highlight}
            setHighlight={setHighlight}
          />
        </motion.div>

        {/* Pipeline complete note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springSoft, delay: 0.4 }}
          className="flex items-center gap-4 rounded-3xl px-6 py-5"
          style={{
            background: 'color-mix(in srgb, #3a3532 6%, #faf6f0)',
            border: '1px solid #3a353222',
          }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-cream"
            style={{ background: '#3a3532' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3 8L7 12L13 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Pipeline complete</p>
            <p className="text-xs text-charcoal/55">
              Data → Signal processing → 8 features → Loudness correction → Fit mechanisms →
              Validate → Project
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
