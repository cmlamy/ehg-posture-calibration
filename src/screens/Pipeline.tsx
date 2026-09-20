import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { MechanismIcon } from '../components/MechanismIcon'
import { Waveform } from '../components/Waveform'
import { MECHANISMS, MECHANISM_IDS, type MechanismId } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { buildTrace, mechanismSample, mixSample, PHASE_RATE } from '../lib/signal'
import { TARGET_WEIGHTS, CLINICAL_WEIGHTS } from '../lib/mechanisms'

// ─── Shared animation helpers ───────────────────────────────────────────────

function usePhase(speed = PHASE_RATE) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      setPhase((p) => p + ((now - last) / 1000) * speed)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])
  return phase
}

// ─── Step-specific mini-animations ──────────────────────────────────────────

/** Step 1 – two dataset logos converging */
function GatherAnim() {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {[
        { label: 'Seating', color: UI.sageDeep, sub: 'Seated EHG' },
        { label: 'Laying', color: UI.stone, sub: 'Clinical EHG' },
      ].map((d, i) => (
        <motion.div
          key={d.label}
          initial={{ opacity: 0, x: i === 0 ? -5 : 5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springSoft, delay: 0.1 + i * 0.08 }}
          className="flex flex-col items-center gap-2 rounded-2xl border px-5 py-4 text-center"
          style={{ borderColor: `${d.color}55`, background: `${d.color}0d` }}
        >
          <span
            className="h-8 w-8 rounded-full"
            style={{ background: d.color }}
            aria-hidden
          />
          <p className="text-sm font-semibold text-ink">{d.label}</p>
          <p className="text-xs text-charcoal/50">{d.sub}</p>
        </motion.div>
      ))}
    </div>
  )
}

/** Step 2 – raw EHG waveform scrolling */
function ReadAnim() {
  const phase = usePhase(0.4)
  const samples = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t), phase, 12)
  return (
    <div className="rounded-2xl bg-ivory px-4 py-3">
      <p className="mb-1 text-xs text-charcoal/40">Raw EHG — 4 bipolar channels</p>
      <div className="h-14">
        <Waveform samples={samples} color="#3a3532" strokeWidth={1.6} height={56} />
      </div>
    </div>
  )
}

/** Step 3 – 4 channel traces side-by-side */
function BipolarAnim() {
  const phase = usePhase(0.35)
  const channels: { id: MechanismId; label: string }[] = [
    { id: 'heartbeat', label: 'Ch1' },
    { id: 'breathing', label: 'Ch2' },
    { id: 'muscle', label: 'Ch3' },
    { id: 'fetal', label: 'Ch4' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {channels.map(({ id, label }) => {
        const m = MECHANISMS[id]
        const samples = buildTrace((t) => mechanismSample(id, t), phase, 8)
        return (
          <div key={id} className="rounded-xl bg-ivory px-2 py-2">
            <p className="mb-1 text-xs font-medium" style={{ color: m.color }}>
              {label}
            </p>
            <div className="h-10">
              <Waveform
                samples={samples}
                color={m.color}
                dash={m.dash}
                height={40}
                strokeWidth={1.5}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Step 4 – bandpass filter diagram */
function FilterAnim() {
  const w = 300
  const h = 60
  // frequency axis 0–5 Hz, passband 0.2–3 Hz
  const buildPath = () => {
    const pts: string[] = []
    for (let i = 0; i <= 100; i++) {
      const freq = (i / 100) * 5
      let gain = 0
      if (freq >= 0.2 && freq <= 3) {
        // raised cosine edges
        const riseW = 0.15
        const fallW = 0.3
        if (freq < 0.2 + riseW) {
          gain = 0.5 - 0.5 * Math.cos((Math.PI * (freq - 0.2)) / riseW)
        } else if (freq > 3 - fallW) {
          gain = 0.5 + 0.5 * Math.cos((Math.PI * (freq - (3 - fallW))) / fallW)
        } else {
          gain = 1
        }
      }
      const x = (freq / 5) * w
      const y = h - gain * (h - 8) - 4
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return pts.join('')
  }
  return (
    <div className="rounded-2xl bg-ivory px-4 py-3">
      <div className="mb-1 flex justify-between text-xs text-charcoal/40">
        <span>0 Hz</span>
        <span className="text-sage-deep font-medium">0.2–3 Hz passband</span>
        <span>5 Hz</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none">
        <motion.path
          d={buildPath()}
          fill="none"
          stroke="#5f6b58"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* shade passband */}
        <rect
          x={(0.2 / 5) * w}
          y={4}
          width={((3 - 0.2) / 5) * w}
          height={h - 8}
          fill="#5f6b58"
          opacity={0.07}
          rx={3}
        />
      </svg>
    </div>
  )
}

/** Step 5 – timeline chopped into 1-min clips */
function ClipsAnim() {
  const clipCount = 6
  return (
    <div className="space-y-2">
      <div className="relative h-6 rounded-full bg-blush/50">
        <p className="absolute inset-0 flex items-center justify-center text-xs text-charcoal/50">
          Long recording
        </p>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: clipCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ ...springSoft, delay: 0.05 + i * 0.07 }}
            style={{ transformOrigin: 'left' }}
            className="flex h-9 flex-1 items-center justify-center rounded-xl bg-stone/20 text-xs font-medium text-stone"
          >
            {String(i + 1).padStart(2, '0')}
          </motion.div>
        ))}
        <div className="flex h-9 flex-1 items-center justify-center rounded-xl border border-dashed border-charcoal/20 text-xs text-charcoal/30">
          …
        </div>
      </div>
      <p className="text-xs text-charcoal/40">Each clip = 60 s · processed independently</p>
    </div>
  )
}

/** Step 6 – 8 feature bars */
function FeaturesAnim() {
  const labels = ['F0', 'F1', 'P0.3', 'P0.8', 'P1.4', 'P2.2', 'Ent', 'RMS']
  const values = [0.62, 0.44, 0.71, 0.38, 0.55, 0.49, 0.67, 0.52]
  return (
    <div className="grid grid-cols-4 gap-2">
      {labels.map((label, i) => (
        <div key={label} className="rounded-xl bg-ivory px-3 py-2">
          <p className="text-xs font-mono text-charcoal/50">{label}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-blush/60">
            <motion.div
              className="h-full rounded-full"
              style={{ background: UI.stone }}
              initial={{ width: 0 }}
              animate={{ width: `${values[i] * 100}%` }}
              transition={{ ...springSoft, delay: 0.05 + i * 0.04 }}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-ink">{values[i].toFixed(2)}</p>
        </div>
      ))}
    </div>
  )
}

/** Step 7 – Loudness correction (equipment correction, NOT a slider) */
function LoudnessCorrectionAnim() {
  const phase = usePhase(0.3)
  const rawSamples = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t) * 2.4, phase, 8)
  const correctedSamples = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t), phase, 8)

  return (
    <div className="space-y-3">
      {/* Equipment correction callout */}
      <div className="flex items-start gap-3 rounded-2xl border border-stone/40 bg-stone/8 px-4 py-3">
        <span className="mt-0.5 flex-shrink-0 text-base">⚙</span>
        <p className="text-xs leading-relaxed text-charcoal/70">
          <strong className="text-charcoal/90">Equipment correction only.</strong> Laying was recorded
          with different hardware than Seating. A fixed dataset-level amplitude ratio is applied
          before spectral feature comparison — this is not a tuneable parameter.
        </p>
      </div>

      {/* Before / ratio / after */}
      <div className="grid grid-cols-3 gap-3 items-center">
        <div className="rounded-xl bg-ivory px-3 py-2">
          <p className="mb-1 text-xs text-charcoal/70 font-medium">Laying (raw)</p>
          <div className="h-10">
            <Waveform samples={rawSamples} color={UI.charcoal} strokeWidth={1.6} height={40} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="rounded-xl bg-ivory px-3 py-2 text-center w-full">
            <p className="text-xs text-charcoal/40 leading-tight">Dataset</p>
            <p className="text-xs text-charcoal/40 leading-tight">amplitude</p>
            <p className="text-xs text-charcoal/40 leading-tight">ratio</p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink">÷ 2.4×</p>
          </div>
          <svg width="32" height="12" viewBox="0 0 32 12" fill="none" aria-hidden>
            <path d="M2 6H30M24 2L30 6L24 10" stroke="#5f6b58" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="rounded-xl bg-ivory px-3 py-2">
          <p className="mb-1 text-xs text-sage-deep font-medium">Corrected</p>
          <div className="h-10">
            <Waveform samples={correctedSamples} color="#5f6b58" strokeWidth={1.6} height={40} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Step 8 – 5 mechanism streams converging */
function FitMechanismsAnim() {
  const phase = usePhase(0.5)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {MECHANISM_IDS.map((id) => {
          const m = MECHANISMS[id]
          const samples = buildTrace((t) => mechanismSample(id, t), phase, 6)
          return (
            <div key={id} className="rounded-xl bg-ivory px-2 py-2">
              <div className="mb-1 flex items-center gap-1.5">
                <MechanismIcon id={id} className="h-3.5 w-3.5" />
                <p className="text-xs font-medium" style={{ color: m.color }}>
                  {m.short}
                </p>
              </div>
              <div className="h-8">
                <Waveform samples={samples} color={m.color} dash={m.dash} height={32} strokeWidth={1.4} />
              </div>
            </div>
          )
        })}
      </div>
      <svg viewBox="0 0 400 44" className="h-10 w-full" aria-hidden>
        {[50, 150, 250, 350].map((x, i) => (
          <motion.path
            key={i}
            d={`M ${x} 0 C ${x} 30, 200 25, 200 44`}
            fill="none"
            stroke={MECHANISMS[MECHANISM_IDS[i]].color}
            strokeWidth={1.8}
            strokeDasharray={MECHANISMS[MECHANISM_IDS[i]].dash || undefined}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ ...springSoft, delay: 0.08 + i * 0.06 }}
          />
        ))}
      </svg>
      <div className="h-12 rounded-xl bg-ivory px-3 py-2">
        <Waveform
          samples={buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase, 8)}
          color="#3a3532"
          strokeWidth={2}
          height={40}
        />
      </div>
    </div>
  )
}

/** Step 9 – clinical → calibrated morphing */
function ApplyCalibrationAnim() {
  const phase = usePhase(0.4)
  const clinical = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t), phase, 8)
  const calibrated = buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase, 8)
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-ivory px-3 py-2">
        <p className="mb-1 text-xs text-charcoal/50 font-medium">Clinical (before)</p>
        <div className="h-12">
          <Waveform samples={clinical} color="#3a3532" strokeWidth={1.6} height={48} dash="5 4" />
        </div>
      </div>
      <div className="rounded-xl bg-ivory px-3 py-2 ring-1 ring-sage-deep/40">
        <p className="mb-1 text-xs text-sage-deep font-medium">Calibrated (after)</p>
        <div className="h-12">
          <Waveform samples={calibrated} color="#5f6b58" strokeWidth={1.8} height={48} />
        </div>
      </div>
    </div>
  )
}

/** Step 10 – validation: 3 result chips */
function ValidateAnim() {
  const results = [
    { label: 'Distribution similarity', value: 'MMD ↓ 61%', color: '#5f6b58' },
    { label: 'Biological plausibility', value: '4 / 4 checks', color: UI.sageDeep },
    { label: 'Contraction detection', value: 'AUC 0.81', color: UI.stone },
  ]
  return (
    <div className="flex flex-col gap-2">
      {results.map((r, i) => (
        <motion.div
          key={r.label}
          initial={{ opacity: 0, x: -3 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springSoft, delay: 0.06 + i * 0.08 }}
          className="flex items-center justify-between rounded-2xl bg-ivory px-4 py-3"
        >
          <p className="text-sm text-charcoal/70">{r.label}</p>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-cream"
            style={{ background: r.color }}
          >
            {r.value}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

/** Step 11 – projection: seated → uncertainty band */
function ProjectAnim() {
  const phase = usePhase(0.25)
  const w = 400
  const h = 70
  const n = 60

  // seated baseline
  const seatedY = h * 0.72
  // simulated standing outcomes fan out
  const outcomePaths = Array.from({ length: 18 }, (_, i) => {
    const offset = ((i - 9) / 9) * 20 + Math.sin(phase * 0.6 + i) * 3
    const pts = Array.from({ length: n }, (_, j) => {
      const x = (j / (n - 1)) * w
      const progress = j / (n - 1)
      if (progress < 0.4) return `${x},${seatedY}`
      const fan = (progress - 0.4) / 0.6
      const y = seatedY - fan * (28 + offset)
      return `${x},${y}`
    }).join(' ')
    const alpha = 0.06 + Math.abs((i - 9) / 9) * 0.04
    return { pts, alpha }
  })

  return (
    <div className="rounded-2xl bg-ivory px-4 py-3">
      <div className="mb-1 flex justify-between text-xs text-charcoal/40">
        <span>Seated</span>
        <span>→ Standing (simulated range)</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
        {/* Uncertainty band paths */}
        {outcomePaths.map(({ pts, alpha }, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke={UI.stone}
            strokeWidth={1.2}
            opacity={alpha}
          />
        ))}
        {/* Seated baseline */}
        <line x1={0} y1={seatedY} x2={w * 0.41} y2={seatedY} stroke="#3a3532" strokeWidth={1.8} strokeLinecap="round" />
        {/* Transition marker */}
        <line x1={w * 0.4} y1={4} x2={w * 0.4} y2={h - 4} stroke="#3a3532" strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />
      </svg>
      <p className="text-xs text-charcoal/40">Never a single predicted line — always a simulated range</p>
    </div>
  )
}

// ─── Pipeline step definitions ───────────────────────────────────────────────

interface PipelineStep {
  num: string
  title: string
  tag: string
  color: string
  summary: string
  detail: string
  mechanisms?: MechanismId[]
  animation?: React.ReactNode
  special?: 'loudness'
}

const STEPS: PipelineStep[] = [
  {
    num: '01',
    title: 'Gather data',
    tag: 'Input',
    color: UI.charcoal,
    summary: 'Two EHG sources: Seating (seated) and Laying (clinical, contraction-labelled).',
    detail:
      'No other data sources are introduced at any point. Seating provides real-world seated physiological variation; Laying provides clinically annotated contraction events and the target spectral distribution.',
    animation: <GatherAnim />,
  },
  {
    num: '02',
    title: 'Read raw recordings',
    tag: 'I/O',
    color: UI.charcoal,
    summary: 'Load raw EDF/mat files. Extract multi-channel surface electrode recordings.',
    detail:
      'Raw recordings are read at full resolution before any processing. Each file contains synchronised multi-channel time-series data sampled from abdominal surface electrodes.',
    animation: <ReadAnim />,
  },
  {
    num: '03',
    title: 'Bipolar channel pairs',
    tag: 'Signal',
    color: UI.sageDeep,
    summary: 'Form bipolar pairs from adjacent electrodes to suppress common-mode noise.',
    detail:
      'Adjacent electrode signals are subtracted to form bipolar pairs (differential EHG). This removes shared noise (mains interference, motion artefacts) while preserving locally-generated uterine activity. Four bipolar channels are retained per recording.',
    animation: <BipolarAnim />,
  },
  {
    num: '04',
    title: 'Bandpass filter',
    tag: 'Signal',
    color: UI.sageDeep,
    summary: '0.2–3 Hz bandpass isolates the EHG frequency band of interest.',
    detail:
      'A zero-phase Butterworth bandpass filter (0.2–3 Hz) is applied to each bipolar channel. The lower cutoff removes baseline wander and respiration DC drift; the upper cutoff removes high-frequency EMG and electrical noise outside the EHG band.',
    animation: <FilterAnim />,
  },
  {
    num: '05',
    title: '1-minute clips',
    tag: 'Segmentation',
    color: UI.stone,
    summary: 'Long recordings are segmented into 60-second non-overlapping clips.',
    detail:
      'Each filtered recording is cut into 60-second windows. Clips with excessive artefact (kurtosis threshold) are rejected. Remaining clips become the unit of analysis — spectral features are computed per clip, per channel.',
    animation: <ClipsAnim />,
  },
  {
    num: '06',
    title: '8 spectral features',
    tag: 'Features',
    color: UI.stone,
    summary: 'Each clip is summarised as an 8-dimensional spectral feature vector.',
    detail:
      'For each clip: median frequency (F0, F1), power in sub-bands (P0.3, P0.8, P1.4, P2.2), spectral entropy (Ent), and RMS amplitude. These 8 values form the feature vector used for MMD optimisation and validation. Every comparison in the pipeline operates on this representation.',
    animation: <FeaturesAnim />,
  },
  {
    num: '07',
    title: 'Loudness correction',
    tag: 'Correction',
    color: UI.stone,
    summary: 'Hardware-level amplitude mismatch between datasets is corrected before comparison.',
    detail:
      'Laying recordings have systematically higher amplitude than Seating recordings due to different electrode setups and hardware. A fixed dataset-level ratio (derived from RMS comparison across all clips) is applied to normalise Laying amplitude before spectral feature comparison. This is an equipment correction — it is computed once, not optimised.',
    special: 'loudness',
    animation: <LoudnessCorrectionAnim />,
  },
  {
    num: '08',
    title: 'Fit mechanisms',
    tag: 'Calibration',
    color: '#3a3532',
    summary: 'Five mechanism weights are optimised to minimise MMD.',
    detail:
      'Mechanism weights (maternal heartbeat, breathing, muscle noise, fetal movement, electrode signal) are searched over using MMD as the loss. The fitted mix weight vector minimises the distance between the 8-feature distribution of calibrated Seating clips and the Laying reference distribution. Optimisation uses Seating Half A only.',
    mechanisms: ['heartbeat', 'breathing', 'muscle', 'fetal', 'electrode'],
    animation: <FitMechanismsAnim />,
  },
  {
    num: '09',
    title: 'Apply calibration',
    tag: 'Transform',
    color: '#3a3532',
    summary: 'Fitted weights are applied to transform the Seating signal.',
    detail:
      'The optimised weight vector from Step 8 is applied to all Seating Half A clips to produce calibrated signals. The feature distribution of calibrated clips is compared against the Laying reference to confirm the transform moved the signal in the expected direction.',
    animation: <ApplyCalibrationAnim />,
  },
  {
    num: '10',
    title: 'Validate',
    tag: 'Validation',
    color: '#5f6b58',
    summary: 'Held-out Seating Half B tests whether calibration generalises.',
    detail:
      'The calibration transform is applied to Seating Half B — participants never seen during fitting. Three validation criteria: (1) MMD between calibrated Half B and Laying should be lower than uncalibrated Half B MMD; (2) Mechanism weights should be biologically plausible; (3) Contraction detection AUC on calibrated signal should match or exceed Laying baseline.',
    animation: <ValidateAnim />,
  },
  {
    num: '11',
    title: 'Project to standing',
    tag: 'Projection',
    color: '#5f6b58',
    summary: 'Calibrated seated signal is projected to estimate standing EHG characteristics.',
    detail:
      'Using literature ranges for postural EHG change, 50–100 simulated standing outcomes are generated from the calibrated seated baseline. The result is always shown as an uncertainty band — never a single predicted line. This projection surfaces the range of plausible standing signal characteristics, not a point estimate.',
    animation: <ProjectAnim />,
  },
]

// ─── Single pipeline step block ──────────────────────────────────────────────

function PipelineStepBlock({
  step,
  index,
  isOpen,
  onToggle,
}: {
  step: PipelineStep
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px 0px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 6 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...springSoft, delay: Math.min(index * 0.04, 0.3) }}
      className="relative"
    >
      {/* Connecting vertical line (all except last) */}
      {index < STEPS.length - 1 && (
        <div
          className="absolute left-[27px] top-[56px] w-px bg-blush-deep/50"
          style={{ height: 'calc(100% - 8px)' }}
          aria-hidden
        />
      )}

      <button
        id={`pipeline-step-${step.num}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group relative w-full text-left"
      >
        <div
          className="flex items-start gap-5 rounded-3xl px-5 py-5 transition-colors"
          style={{
            background: isOpen
              ? `color-mix(in srgb, ${step.color} 6%, #faf6f0)`
              : 'transparent',
          }}
        >
          {/* Step number node */}
          <motion.div
            animate={{
              background: isOpen ? step.color : '#f4efe6',
              color: isOpen ? '#faf6f0' : '#a09690',
              scale: isOpen ? 1.03 : 1,
            }}
            transition={springSoft}
            className="relative z-10 mt-0.5 flex h-[54px] w-[54px] flex-shrink-0 flex-col items-center justify-center rounded-2xl text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-[10px] font-semibold tracking-widest opacity-60">
              {step.num}
            </span>
            {/* Active glow */}
            {isOpen && (
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{ opacity: [0.18, 0.07, 0.18], scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                style={{ background: step.color }}
              />
            )}
          </motion.div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider text-cream uppercase"
                style={{ background: step.color }}
              >
                {step.tag}
              </span>
              {step.special === 'loudness' && (
                <span className="rounded-full border border-stone/60 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-stone uppercase">
                  Equipment correction
                </span>
              )}
            </div>

            <h2 className="mt-1.5 font-display text-2xl font-medium tracking-tight text-ink">
              {step.title}
            </h2>
            <p className="mt-1 text-sm text-charcoal/60">{step.summary}</p>

            {/* Mechanism icons inline */}
            {step.mechanisms && (
              <div className="mt-2 flex gap-2">
                {step.mechanisms.map((id) => (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded-full bg-ivory px-2.5 py-1 text-xs"
                    style={{ color: MECHANISMS[id].color }}
                  >
                    <MechanismIcon id={id} className="h-3.5 w-3.5" />
                    {MECHANISMS[id].short}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={springSoft}
            className="mt-2 flex-shrink-0 text-charcoal/30 group-hover:text-charcoal/60"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 95, damping: 27 }}
            className="overflow-hidden"
          >
            <div className="ml-[74px] mr-4 pb-4">
              <div
                className="rounded-3xl p-5 ring-1"
                style={{
                  background: `color-mix(in srgb, ${step.color} 4%, #faf6f0)`,
                  boxShadow: `inset 0 0 0 1px ${step.color}30`,
                }}
              >
                {/* Long explanation */}
                <p className="mb-4 text-sm leading-relaxed text-charcoal/70">{step.detail}</p>

                {/* Mini-animation */}
                {step.animation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Pipeline page ───────────────────────────────────────────────────────────

export function Pipeline() {
  const [openStep, setOpenStep] = useState<number | null>(null)

  const toggle = (i: number) => setOpenStep((prev) => (prev === i ? null : i))

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-2">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="mb-10"
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            How it works
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Pipeline
          </h1>
          <p className="mt-3 max-w-xl text-lg text-charcoal/70">
            Eleven steps from raw recordings to calibrated, projected signals. Click any step to expand.
          </p>

          {/* Canonical pipeline summary */}
          <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-2xl bg-cream px-5 py-4 ring-1 ring-blush/60 text-xs text-charcoal/50">
            {[
              'Data',
              'Signal processing',
              '8 features',
              'Loudness correction',
              'Fit mechanisms',
              'Validate',
              'Project',
            ].map((label, i, arr) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="font-medium text-charcoal/70">{label}</span>
                {i < arr.length - 1 && <span className="opacity-40">→</span>}
              </span>
            ))}
          </div>
        </motion.header>

        {/* Steps */}
        {STEPS.map((step, i) => (
          <PipelineStepBlock
            key={step.num}
            step={step}
            index={i}
            isOpen={openStep === i}
            onToggle={() => toggle(i)}
          />
        ))}

      </div>
    </div>
  )
}
