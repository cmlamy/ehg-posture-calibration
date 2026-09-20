import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CalibrationShift } from '../components/CalibrationShift'
import { ComparisonPanels } from '../components/ComparisonPanels'
import { CompositionDonut } from '../components/CompositionDonut'
import { ConvergingHero } from '../components/ConvergingHero'
import { MechanismSlider } from '../components/MechanismSlider'
import { SignalDistance } from '../components/SignalDistance'
import {
  CLINICAL_WEIGHTS,
  MECHANISM_IDS,
  type MechanismId,
  type Weights,
} from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import {
  compositionDeltas,
  compositionShares,
  compositionShift,
  mmdDistance,
  PHASE_RATE,
  targetMatch,
  tracesFromWeights,
} from '../lib/signal'

export function FindTheSignal() {
  const [weights, setWeights] = useState<Weights>(CLINICAL_WEIGHTS)
  // The "before" mix every comparison is measured against. Defaults to the
  // clinical starting point; the researcher can re-anchor it to any state.
  const [baseline, setBaseline] = useState<Weights>(CLINICAL_WEIGHTS)
  const [isAnchored, setIsAnchored] = useState(false)
  const [phase, setPhase] = useState(0)
  const [hovered, setHovered] = useState<MechanismId | null>(null)
  const [history, setHistory] = useState<number[]>(() => [mmdDistance(CLINICAL_WEIGHTS)])
  const lastRecorded = useRef(history[0])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setPhase((p) => p + dt * PHASE_RATE)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const traces = useMemo(() => tracesFromWeights(weights, phase), [weights, phase])
  const donut = useMemo(() => compositionShares(weights), [weights])
  const mmd = useMemo(() => mmdDistance(weights), [weights])

  const deltas = useMemo(() => compositionDeltas(baseline, weights), [baseline, weights])
  const shift = useMemo(() => compositionShift(baseline, weights), [baseline, weights])
  const matchBefore = useMemo(() => targetMatch(baseline), [baseline])
  const matchAfter = useMemo(() => targetMatch(weights), [weights])
  const mmdBaseline = useMemo(() => mmdDistance(baseline), [baseline])

  useEffect(() => {
    if (Math.abs(mmd - lastRecorded.current) < 0.0008) return
    lastRecorded.current = mmd
    setHistory((prev) => [...prev.slice(-47), mmd])
  }, [mmd])

  const onChange = (id: MechanismId, next: number) => {
    setWeights((prev) => ({ ...prev, [id]: next }))
  }

  const reanchor = () => {
    setBaseline(weights)
    setIsAnchored(true)
  }

  const resetBaseline = () => {
    setBaseline(CLINICAL_WEIGHTS)
    setIsAnchored(false)
  }

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Match the signal
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Find the signal
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/80">
            Fit five signal mechanisms to bring the clinical signal closer to
            real-world seated EHG.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.05 }}
        >
          <ConvergingHero
            mini={traces.mechanisms}
            combined={traces.combined}
            hovered={hovered}
          />
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {MECHANISM_IDS.map((id, i) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSoft, delay: 0.1 + i * 0.06 }}
              >
                <MechanismSlider
                  id={id}
                  value={weights[id]}
                  samples={traces.mechanisms[id]}
                  emphasized={hovered === id}
                  onChange={onChange}
                  onHover={setHovered}
                />
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.22 }}
          >
            <CompositionDonut data={donut} hovered={hovered} onHover={setHovered} />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.26 }}
        >
          <CalibrationShift
            deltas={deltas}
            shift={shift}
            matchBefore={matchBefore}
            matchAfter={matchAfter}
            mmdBefore={mmdBaseline}
            mmdAfter={mmd}
            onReanchor={reanchor}
            onReset={resetBaseline}
            isAnchored={isAnchored}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.3 }}
        >
          <SignalDistance mmd={mmd} history={history} />
        </motion.div>

        <ComparisonPanels
          clinical={traces.clinical}
          calibrated={traces.combined}
          target={traces.target}
        />
      </div>
    </div>
  )
}
