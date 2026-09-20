import { motion, useMotionValueEvent, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ComparisonPanels } from '../components/ComparisonPanels'
import { CompositionDonut } from '../components/CompositionDonut'
import { MechanismSlider } from '../components/MechanismSlider'
import { PostureChart } from '../components/PostureChart'
import { PostureStages } from '../components/PostureStages'
import { SignalDistance } from '../components/SignalDistance'
import { SimulationControls } from '../components/SimulationControls'
import {
  CLINICAL_WEIGHTS,
  FITTED_WEIGHTS,
  MECHANISM_IDS,
  TARGET_WEIGHTS,
  type MechanismId,
  type Weights,
} from '../lib/mechanisms'
import { springFit, springSoft, springSpread } from '../lib/motion'
import {
  generateOutcomes,
  lerpWeights,
  STANDING_WEIGHTS,
  type PosturePhase,
} from '../lib/projection'
import {
  compositionShares,
  mmdDistance,
  PHASE_RATE,
  tracesFromWeights,
} from '../lib/signal'

function mixFor(posture: PosturePhase, fitted: boolean): Weights {
  if (posture === 'standing') return STANDING_WEIGHTS
  if (posture === 'sitting') return fitted ? FITTED_WEIGHTS : TARGET_WEIGHTS
  return CLINICAL_WEIGHTS
}

export function Home() {
  // ── Calibration module state (same as FindTheSignal) ──────────────────────
  const [weights, setWeights] = useState<Weights>(CLINICAL_WEIGHTS)
  const [phase, setPhase] = useState(0)
  const [hovered, setHovered] = useState<MechanismId | null>(null)
  const [history, setHistory] = useState<number[]>(() => [mmdDistance(CLINICAL_WEIGHTS)])
  const lastRecorded = useRef(history[0])

  // ── Posture projection state ──────────────────────────────────────────────
  const [posture, setPosture] = useState<PosturePhase>('laying')
  const [seed, setSeed] = useState(2718)
  const [running, setRunning] = useState(true)
  const [showBand, setShowBand] = useState(true)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [fitted, setFitted] = useState(false)
  const weightsRef = useRef(weights)
  weightsRef.current = weights
  const sliderAnim = useRef(0)

  useEffect(() => {
    const target = mixFor(posture, fitted)
    const start = { ...weightsRef.current }
    const already = MECHANISM_IDS.every((id) => Math.abs(start[id] - target[id]) < 0.002)
    if (already) {
      setWeights(target)
      return
    }
    const origin = performance.now()
    cancelAnimationFrame(sliderAnim.current)
    const tick = (now: number) => {
      const u = Math.min(1, (now - origin) / 2000)
      const ease = 1 - (1 - u) ** 3
      setWeights(lerpWeights(start, target, ease))
      if (u < 1) sliderAnim.current = requestAnimationFrame(tick)
    }
    sliderAnim.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(sliderAnim.current)
  }, [posture, fitted])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setPhase((p) => p + dt * PHASE_RATE)
      frame = requestAnimationFrame(tick)
    }
    if (running) frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  const outcomes = useMemo(() => generateOutcomes(seed), [seed])

  // Spring that fans the outcomes out of the sitting baseline into the range.
  const spreadSpring = useSpring(0, springSpread)
  const [spread, setSpread] = useState(0)
  useMotionValueEvent(spreadSpring, 'change', setSpread)

  const fitSpring = useSpring(0, springFit)
  const [fit, setFit] = useState(0)
  useMotionValueEvent(fitSpring, 'change', setFit)

  useEffect(() => {
    if (posture !== 'sitting') {
      fitSpring.jump(0)
      return
    }
    fitSpring.set(fitted ? 1 : 0)
  }, [fitSpring, fitted, posture])

  useEffect(() => {
    if (posture === 'laying') setFitted(false)
  }, [posture])

  useEffect(() => {
    if (posture !== 'standing') {
      spreadSpring.jump(0)
      return
    }
    spreadSpring.jump(0)
    spreadSpring.set(1)
  }, [spreadSpring, seed, posture])

  const traces = useMemo(() => tracesFromWeights(weights, phase), [weights, phase])
  const donut = useMemo(() => compositionShares(weights), [weights])
  const mmd = useMemo(() => mmdDistance(weights), [weights])

  useEffect(() => {
    if (Math.abs(mmd - lastRecorded.current) < 0.0008) return
    lastRecorded.current = mmd
    setHistory((prev) => [...prev.slice(-47), mmd])
  }, [mmd])

  const onChange = (id: MechanismId, next: number) => {
    cancelAnimationFrame(sliderAnim.current)
    setWeights((prev) => ({ ...prev, [id]: next }))
  }

  return (
    <main className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl space-y-10">

        {/* ── Posture projection hero ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="space-y-4"
        >
          <div>
            <p className="font-display text-sm font-medium tracking-[0.28em] text-ink">
              VERA
            </p>
            <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-charcoal/80 md:text-[1.75rem]">
              Vertical EHG Response Adaptation
            </h1>
          </div>

          <PostureStages posture={posture} onChange={setPosture} />

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_13.5rem]">
            <div className="min-w-0 space-y-4">
              <PostureChart
                posture={posture}
                outcomes={outcomes}
                phase={phase}
                spread={spread}
                highlight={highlight}
                showBand={showBand}
                onHighlight={setHighlight}
                weights={weights}
                fit={fit}
              />

              {posture !== 'laying' && (
                <SimulationControls
                  seed={seed}
                  onReseed={() => setSeed(Math.floor(Math.random() * 99999))}
                  running={running}
                  onToggle={() => setRunning((r) => !r)}
                  showBand={showBand}
                  onToggleBand={() => setShowBand((b) => !b)}
                  simulationActive={posture === 'standing'}
                  showSeed={false}
                  fitAvailable={posture === 'sitting'}
                  fitted={fitted}
                  onFit={() => setFitted((prev) => !prev)}
                />
              )}
            </div>

            <SignalDistance mmd={mmd} history={history} compact />
          </div>
        </motion.div>

        {/* ── Sliders + Donut ───────────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {MECHANISM_IDS.map((id, i) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSoft, delay: 0.18 + i * 0.06 }}
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
            transition={{ ...springSoft, delay: 0.3 }}
          >
            <CompositionDonut data={donut} hovered={hovered} onHover={setHovered} />
          </motion.div>
        </div>

        {/* ── Comparison panels ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.42 }}
        >
          <ComparisonPanels
            clinical={traces.clinical}
            calibrated={traces.combined}
            target={traces.target}
          />
        </motion.div>

      </div>
    </main>
  )
}
