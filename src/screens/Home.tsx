import { motion, useMotionValueEvent, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BackendSittingChart } from '../components/BackendSittingChart'
import { BackendStandingChart } from '../components/BackendStandingChart'
import { ComparisonPanels } from '../components/ComparisonPanels'
import { CompositionDonut } from '../components/CompositionDonut'
import { LiveExperimentModal } from '../components/LiveExperimentModal'
import { MechanismSlider } from '../components/MechanismSlider'
import { PostureChart } from '../components/PostureChart'
import { PostureStages } from '../components/PostureStages'
import { SignalDistance } from '../components/SignalDistance'
import { StandingProtocol } from '../components/StandingProtocol'
import {
  CLINICAL_WEIGHTS,
  MECHANISM_IDS,
  type MechanismId,
  type Weights,
} from '../lib/mechanisms'
import { BACKEND_RESULTS } from '../lib/backendResults.generated'
import { LYING_WINDOW, lyingWindowCaption } from '../lib/lyingWindow'
import { springFit, springSoft } from '../lib/motion'
import {
  lerpWeights,
  type PosturePhase,
} from '../lib/projection'
import {
  compositionShares,
  PHASE_RATE,
  tracesFromWeights,
} from '../lib/signal'

const CALIBRATED_WEIGHTS: Weights = BACKEND_RESULTS.calibration.fittedParameters
const RAW_MMD2 = BACKEND_RESULTS.calibration.rawMmd2
const CALIBRATED_MMD2 = BACKEND_RESULTS.calibration.calibratedMmd2
const CALIBRATION_MATCH = BACKEND_RESULTS.calibration.relativeMmd2Reduction * 100
const MMD2_REDUCTION_CI = BACKEND_RESULTS.calibration.mmd2ReductionCi95
const CALIBRATED_AUC = BACKEND_RESULTS.calibration.calibratedDomainAuc

function mixFor(posture: PosturePhase, fitted: boolean): Weights {
  if (posture === 'standing') return CALIBRATED_WEIGHTS
  if (posture === 'sitting') return fitted ? CALIBRATED_WEIGHTS : CLINICAL_WEIGHTS
  return CLINICAL_WEIGHTS
}

export function Home() {
  // ── Calibration module state (same as FindTheSignal) ──────────────────────
  const [weights, setWeights] = useState<Weights>(CLINICAL_WEIGHTS)
  const [phase, setPhase] = useState(0)
  const [hovered, setHovered] = useState<MechanismId | null>(null)
  const [history, setHistory] = useState<number[]>(() => [RAW_MMD2])
  const lastRecorded = useRef(history[0])

  // ── Posture projection state ──────────────────────────────────────────────
  const [posture, setPosture] = useState<PosturePhase>('laying')
  const [showBand, setShowBand] = useState(true)
  const [fitted, setFitted] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const weightsRef = useRef(weights)
  const sliderAnim = useRef(0)
  const calibrationTimer = useRef<number | null>(null)

  useEffect(() => {
    weightsRef.current = weights
  }, [weights])

  useEffect(
    () => () => {
      if (calibrationTimer.current !== null) window.clearTimeout(calibrationTimer.current)
    },
    [],
  )

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
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

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

  const traces = useMemo(() => tracesFromWeights(weights, phase), [weights, phase])
  const donut = useMemo(() => compositionShares(weights), [weights])
  const displayedMmd2 = fitted || posture === 'standing' ? CALIBRATED_MMD2 : RAW_MMD2

  useEffect(() => {
    if (Math.abs(displayedMmd2 - lastRecorded.current) < 0.0008) return
    lastRecorded.current = displayedMmd2
    setHistory((prev) => [...prev.slice(-47), displayedMmd2])
  }, [displayedMmd2])

  const onChange = (id: MechanismId, next: number) => {
    cancelAnimationFrame(sliderAnim.current)
    setWeights((prev) => ({ ...prev, [id]: next }))
  }

  const onPostureChange = (next: PosturePhase) => {
    if (next !== 'sitting' && calibrationTimer.current !== null) {
      window.clearTimeout(calibrationTimer.current)
      calibrationTimer.current = null
      setCalibrating(false)
    }
    setPosture(next)
    if (next === 'laying') setFitted(false)
  }

  const startCalibration = () => {
    if (calibrating) return
    setCalibrating(true)
    calibrationTimer.current = window.setTimeout(() => {
      setCalibrating(false)
      setFitted(true)
      calibrationTimer.current = null
    }, 5000)
  }

  const runFit = () => {
    if (fitted) {
      setFitted(false)
      return
    }
    startCalibration()
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
          <h1 className="font-display text-2xl font-medium tracking-tight text-charcoal/80 md:text-[1.75rem]">
            Validated Sitting. Projected Standing.
          </h1>

          <PostureStages posture={posture} onChange={onPostureChange} />

          <div
            className={`grid items-start gap-4 ${
              posture === 'standing' ? '' : 'lg:grid-cols-[minmax(0,1fr)_13.5rem]'
            }`}
          >
            <div className="min-w-0 space-y-4">
              {posture === 'standing' ? (
                <BackendStandingChart
                  data={BACKEND_RESULTS.standing}
                  showBand={showBand}
                />
              ) : posture === 'sitting' ? (
                <BackendSittingChart
                  data={BACKEND_RESULTS.calibration.sittingDemo}
                  fit={fit}
                  mmd2ReductionPercent={CALIBRATION_MATCH}
                />
              ) : (
                <PostureChart
                  posture={posture}
                  outcomes={[]}
                  phase={phase}
                  spread={0}
                  highlight={null}
                  showBand={showBand}
                  onHighlight={() => undefined}
                  weights={weights}
                  fit={fit}
                />
              )}

              {posture === 'sitting' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    id="fit-sitting"
                    type="button"
                    onClick={runFit}
                    disabled={calibrating}
                    className="rounded-full bg-sage-deep px-4 py-2 text-sm font-medium text-cream disabled:cursor-wait disabled:opacity-65"
                  >
                    {fitted ? '↺ Reset laying' : 'Fit sitting'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-lg text-charcoal/70 ring-1 ring-blush/60 transition-colors hover:bg-blush/30 hover:text-ink"
                    aria-label="Open live experiment settings"
                    title="Live experiment settings"
                  >
                    ⚙
                  </button>
                  {calibrating && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm text-sage-deep"
                    >
                      Calibrating Model
                    </motion.span>
                  )}
                </div>
              )}
              {posture === 'standing' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    id="toggle-backend-standing-band"
                    onClick={() => setShowBand((visible) => !visible)}
                    aria-pressed={showBand}
                    className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-charcoal/70 ring-1 ring-blush/60 transition-colors hover:bg-blush/30 hover:text-ink"
                  >
                    {showBand ? '◫ Hide band' : '◫ Show band'}
                  </button>
                  <span className="text-xs text-charcoal/40">
                    {BACKEND_RESULTS.standing.draws} backend simulation draws · projected, not validated
                  </span>
                </div>
              )}
              {posture === 'standing' && <StandingProtocol />}
            </div>

            {posture !== 'standing' && (
              <div className="space-y-3">
                <SignalDistance
                  mmd={displayedMmd2}
                  history={history}
                  compact
                  label="Signal Distance (MMD²)"
                  description="Lower is closer to the measured seated dataset."
                />
                {posture === 'sitting' && fitted && (
                  <div className="space-y-2 rounded-3xl bg-cream/80 p-4 ring-1 ring-blush/80">
                    <div>
                      <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-charcoal/45 uppercase">
                        95% CI · MMD² reduction
                      </p>
                      <p className="mt-1 font-mono text-sm text-ink">
                        {MMD2_REDUCTION_CI[0].toFixed(4)} – {MMD2_REDUCTION_CI[1].toFixed(4)}
                      </p>
                    </div>
                    <div className="border-t border-blush/50 pt-2">
                      <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-charcoal/45 uppercase">
                        Calibrated domain AUC
                      </p>
                      <p className="mt-1 font-mono text-sm text-ink">{CALIBRATED_AUC.toFixed(3)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Sliders + Donut ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
              Add to a lying recording
            </p>
            <p className="mt-2 font-mono text-sm text-ink">
              {lyingWindowCaption()}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-charcoal/65">
              Groups only need lying-down EHG. Each card is what to add to that
              trace so it approaches the seated Icelandic target. The percent is
              simulator strength — not heart rate. Assumed maximum is the
              simulator engineering cap for that factor, not a measured ceiling.
            </p>
          </div>
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
                  lyingRms={LYING_WINDOW.rms}
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
      <LiveExperimentModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}
