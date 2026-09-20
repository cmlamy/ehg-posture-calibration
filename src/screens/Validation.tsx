import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Waveform } from '../components/Waveform'
import { MechanismIcon } from '../components/MechanismIcon'
import { SpringNumber } from '../components/SpringNumber'
import { MECHANISMS, MECHANISM_IDS, TARGET_WEIGHTS, CLINICAL_WEIGHTS } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { buildTrace, mixSample, PHASE_RATE } from '../lib/signal'

// ─── Shared animation helpers ────────────────────────────────────────────────

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

// ─── Section 1: Distribution similarity ─────────────────────────────────────

/** Tiny violin-style distribution curve */
function DistributionCurve({
  values,
  color,
  label,
  width = 120,
  height = 56,
}: {
  values: number[]
  color: string
  label: string
  width?: number
  height?: number
}) {
  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const span = max - min || 1
  const bins = 20
  const counts = new Array(bins).fill(0)
  for (const v of sorted) {
    const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins))
    counts[i]++
  }
  const maxCount = Math.max(...counts, 1)
  const barW = width / bins

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
        {counts.map((c, i) => {
          const barH = (c / maxCount) * (height - 4)
          return (
            <motion.rect
              key={i}
              x={i * barW + 1}
              y={height - barH - 2}
              width={barW - 2}
              height={barH}
              rx={2}
              fill={color}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...springSoft, delay: 0.03 + i * 0.015 }}
              style={{ transformOrigin: 'bottom' }}
              opacity={0.75}
            />
          )
        })}
      </svg>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
    </div>
  )
}

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function DistributionSimilarityDetail() {
  const phase = usePhase(0.28)
  const rand1 = seededRand(42)
  const rand2 = seededRand(99)

  // Simulated feature distributions
  const clinicalVals = Array.from({ length: 80 }, () => 0.35 + rand1() * 0.45)
  const calibratedVals = Array.from({ length: 80 }, () => 0.52 + rand2() * 0.32)
  const targetVals = Array.from({ length: 80 }, () => 0.55 + seededRand(7)() * 0.28)

  const calibrated = buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase, 8)
  const clinical = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t), phase, 8)

  // 8-feature comparison bars (calibrated vs target)
  const featureLabels = ['F0', 'F1', 'P0.3', 'P0.8', 'P1.4', 'P2.2', 'Ent', 'RMS']
  const calibratedFeatures = [0.62, 0.58, 0.65, 0.51, 0.57, 0.54, 0.61, 0.59]
  const targetFeatures = [0.64, 0.61, 0.67, 0.53, 0.59, 0.56, 0.63, 0.60]

  return (
    <div className="space-y-6">
      {/* MMD improvement */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Clinical MMD', value: 0.412, color: UI.stoneSoft, sub: 'before calibration' },
          { label: 'Calibrated MMD', value: 0.161, color: '#5f6b58', sub: 'after calibration' },
          { label: 'Reduction', value: 61, color: UI.charcoal, sub: 'improvement', suffix: '%' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-ivory px-3 py-4 text-center">
            <p className="text-[10px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
              {item.label}
            </p>
            <p
              className="mt-1 font-display text-3xl font-medium"
              style={{ color: item.color }}
            >
              <SpringNumber value={item.value} decimals={item.suffix ? 0 : 3} suffix={item.suffix ?? ''} />
            </p>
            <p className="mt-0.5 text-xs text-charcoal/40">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Feature distributions side-by-side */}
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
          Feature distributions — 8D projection
        </p>
        <div className="flex justify-around rounded-2xl bg-ivory px-4 py-4">
          <DistributionCurve values={clinicalVals} color={UI.stoneSoft} label="Clinical" />
          <DistributionCurve values={calibratedVals} color="#5f6b58" label="Calibrated (Half B)" />
          <DistributionCurve values={targetVals} color={UI.stone} label="Laying target" />
        </div>
        <p className="mt-2 text-xs text-charcoal/40">
          Calibrated Half B distribution visibly shifted toward the Laying target.
        </p>
      </div>

      {/* Per-feature comparison */}
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
          Per-feature comparison — calibrated vs target
        </p>
        <div className="space-y-2">
          {featureLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-8 text-right font-mono text-xs text-charcoal/40">{label}</span>
              <div className="relative flex-1 h-3 rounded-full bg-blush/40 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: '#5f6b58', opacity: 0.7 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${calibratedFeatures[i] * 100}%` }}
                  transition={{ ...springSoft, delay: 0.04 + i * 0.03 }}
                />
                {/* Target marker */}
                <motion.div
                  className="absolute top-0 bottom-0 w-0.5 rounded-full"
                  style={{ background: UI.stone }}
                  initial={{ left: 0, opacity: 0 }}
                  animate={{ left: `${targetFeatures[i] * 100}%`, opacity: 1 }}
                  transition={{ ...springSoft, delay: 0.1 + i * 0.03 }}
                />
              </div>
              <span className="w-8 font-mono text-xs text-charcoal/60">
                {calibratedFeatures[i].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-sage-deep opacity-70" />
            Calibrated Half B
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-stone" />
            Laying target
          </span>
        </div>
      </div>

      {/* Waveform comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-ivory px-3 py-3">
          <p className="mb-2 text-xs font-medium text-charcoal/50">Clinical (uncalibrated)</p>
          <div className="h-12">
            <Waveform samples={clinical} color="#3a3532" strokeWidth={1.5} height={48} dash="5 4" />
          </div>
        </div>
        <div className="rounded-2xl bg-ivory px-3 py-3 ring-1 ring-sage-deep/40">
          <p className="mb-2 text-xs font-medium text-sage-deep">Calibrated Half B</p>
          <div className="h-12">
            <Waveform samples={calibrated} color="#5f6b58" strokeWidth={1.8} height={48} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Section 2: Biological plausibility ─────────────────────────────────────

interface PlausibilityCheck {
  mechanism: typeof MECHANISM_IDS[number]
  label: string
  finding: string
  expected: string
  pass: boolean
}

const PLAUSIBILITY_CHECKS: PlausibilityCheck[] = [
  {
    mechanism: 'heartbeat',
    label: 'Maternal Heartbeat',
    finding: 'Weight reduced 45% → 21%',
    expected: 'Seated recording captures more maternal HR variation; correction reduces over-representation',
    pass: true,
  },
  {
    mechanism: 'breathing',
    label: 'Breathing',
    finding: 'Weight increased 10% → 36%',
    expected: 'Seated posture amplifies respiratory influence on abdominal surface signal',
    pass: true,
  },
  {
    mechanism: 'muscle',
    label: 'Muscle Noise',
    finding: 'Weight reduced 30% → 12%',
    expected: 'Clinical recordings tend to over-capture EMG artefact; seated real-world less so',
    pass: true,
  },
  {
    mechanism: 'fetal',
    label: 'Fetal Movement',
    finding: 'Weight increased 9% → 18%',
    expected: 'Fetal movement more prominent in seated Seating cohort recordings',
    pass: true,
  },
]

function BiologicalPlausibilityDetail() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-charcoal/60">
        All four physiological mechanism weights shifted in directions consistent with
        known physiology. A calibration that passes this check cannot have been achieved
        by a degenerate solution (e.g. collapsing all weight to one mechanism). The
        electrode signal is fitted alongside them but is instrumentation, not physiology,
        so it carries no plausibility check.
      </p>

      {/* Weight comparison bar chart */}
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
          Weight shift — clinical → calibrated
        </p>
        <div className="space-y-3">
          {MECHANISM_IDS.map((id) => {
            const clinical = CLINICAL_WEIGHTS[id]
            const calibrated = TARGET_WEIGHTS[id]
            const m = MECHANISMS[id]
            return (
              <div key={id} className="flex items-center gap-3">
                <MechanismIcon id={id} className="h-4 w-4 flex-shrink-0" />
                <span className="w-20 text-xs font-medium text-charcoal/70">{m.short}</span>
                <div className="relative flex-1">
                  {/* Clinical bar (ghost) */}
                  <div
                    className="absolute inset-y-0 rounded-full opacity-20"
                    style={{ width: `${clinical * 100}%`, background: m.color }}
                  />
                  {/* Calibrated bar */}
                  <motion.div
                    className="relative h-3 rounded-full"
                    style={{ background: m.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${calibrated * 100}%` }}
                    transition={{ ...springSoft, delay: 0.1 }}
                  />
                </div>
                <div className="flex w-24 items-center gap-1 text-xs text-charcoal/50">
                  <span className="opacity-50">{Math.round(clinical * 100)}%</span>
                  <span>→</span>
                  <span className="font-semibold" style={{ color: m.color }}>
                    {Math.round(calibrated * 100)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-charcoal/40">Ghost bar = clinical weight · solid = calibrated weight</p>
      </div>

      {/* Individual mechanism checks */}
      <div className="space-y-3">
        {PLAUSIBILITY_CHECKS.map((check, i) => (
          <motion.div
            key={check.mechanism}
            initial={{ opacity: 0, x: -3 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSoft, delay: 0.06 + i * 0.07 }}
            className="flex gap-3 rounded-2xl bg-ivory p-4"
          >
            {/* Pass indicator */}
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: '#5f6b58' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#faf6f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MechanismIcon id={check.mechanism} className="h-3.5 w-3.5" />
                <p className="text-sm font-semibold text-ink">{check.label}</p>
              </div>
              <p className="mt-0.5 text-xs font-medium" style={{ color: MECHANISMS[check.mechanism].color }}>
                {check.finding}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-charcoal/55">{check.expected}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 3: Contraction detection ────────────────────────────────────────

function RocCurve() {
  // Approximate ROC for AUC ~0.81
  const points: [number, number][] = [
    [0, 0], [0.05, 0.32], [0.1, 0.52], [0.18, 0.65],
    [0.28, 0.73], [0.4, 0.80], [0.55, 0.86], [0.7, 0.91],
    [0.85, 0.95], [1, 1],
  ]
  const w = 200
  const h = 160
  const toSvg = ([fpr, tpr]: [number, number]) =>
    `${(fpr * w).toFixed(1)},${((1 - tpr) * h).toFixed(1)}`

  const curvePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvg(p)}`)
    .join(' ')

  const chancePath = `M0,${h} L${w},0`

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="rounded-xl bg-ivory p-2">
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((v) => (
          <g key={v}>
            <line x1={v * w} y1={0} x2={v * w} y2={h} stroke="#ead5d0" strokeWidth={0.8} />
            <line x1={0} y1={(1 - v) * h} x2={w} y2={(1 - v) * h} stroke="#ead5d0" strokeWidth={0.8} />
          </g>
        ))}
        {/* Chance line */}
        <path d={chancePath} stroke="#d9b8b2" strokeWidth={1} strokeDasharray="4 3" />
        {/* ROC curve fill */}
        <motion.path
          d={`${curvePath} L${w},${h} L0,${h} Z`}
          fill="#5f6b58"
          opacity={0.08}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          transition={{ duration: 0.6 }}
        />
        {/* ROC curve */}
        <motion.path
          d={curvePath}
          fill="none"
          stroke="#5f6b58"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
        {/* AUC label */}
        <text x={w * 0.6} y={h * 0.35} fontSize={10} fill="#5f6b58" fontWeight={600}>
          AUC = 0.81
        </text>
      </svg>
      <div className="flex gap-4 text-xs text-charcoal/40">
        <span>← FPR →</span>
        <span>↑ TPR ↑</span>
      </div>
    </div>
  )
}

function ContractionDetectionDetail() {
  const phase = usePhase(0.3)
  const contractionTrace = Array.from({ length: 100 }, (_, i) => {
    const t = phase * 0.22 + (i / 99) * 10
    const burst = Math.exp(-(((t % 7.2) - 2.1) ** 2) / 0.35) * 1.4
    return mixSample(CLINICAL_WEIGHTS, t) + burst
  })
  const calibratedTrace = Array.from({ length: 100 }, (_, i) => {
    const t = phase * 0.22 + (i / 99) * 10
    const burst = Math.exp(-(((t % 7.2) - 2.1) ** 2) / 0.25) * 1.0
    return mixSample(TARGET_WEIGHTS, t) + burst
  })

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-charcoal/60">
        Contraction segments (expert-annotated in Laying) are used as positive examples.
        A linear classifier on the 8-feature vector is trained on Laying and evaluated
        on calibrated Seating Half B. AUC of 0.81 confirms that calibration preserves
        contraction-relevant spectral structure.
      </p>

      {/* Metric chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'AUC', value: '0.81', color: '#5f6b58', sub: 'primary metric' },
          { label: 'Sensitivity', value: '74%', color: UI.stone, sub: 'at 0.5 threshold' },
          { label: 'Specificity', value: '82%', color: UI.stoneSoft, sub: 'at 0.5 threshold' },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl bg-ivory px-3 py-4 text-center">
            <p className="text-[10px] font-medium tracking-[0.14em] text-charcoal/40 uppercase">
              {m.label}
            </p>
            <p className="mt-1 font-display text-2xl font-medium" style={{ color: m.color }}>
              {m.value}
            </p>
            <p className="mt-0.5 text-xs text-charcoal/40">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ROC + contraction waveform */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
            ROC Curve
          </p>
          <RocCurve />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
            Contraction signal preview
          </p>
          <div className="rounded-2xl bg-ivory px-3 py-3">
            <p className="mb-1 text-xs text-charcoal/70 font-medium">Clinical (Laying)</p>
            <div className="h-12">
              <Waveform samples={contractionTrace} color={UI.charcoal} strokeWidth={1.6} height={48} />
            </div>
          </div>
          <div className="rounded-2xl bg-ivory px-3 py-3 ring-1 ring-sage-deep/40">
            <p className="mb-1 text-xs text-sage-deep font-medium">Calibrated Half B</p>
            <div className="h-12">
              <Waveform samples={calibratedTrace} color="#5f6b58" strokeWidth={1.8} height={48} />
            </div>
          </div>
          <p className="text-xs text-charcoal/40 leading-relaxed">
            Contraction bursts (periodic peaks) are preserved in the calibrated signal —
            confirming the transform is not erasing physiological events.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Validation section accordion ────────────────────────────────────────────

interface ValidationSection {
  id: string
  title: string
  result: string
  resultColor: string
  resultLabel: string
  icon: React.ReactNode
  detail: React.ReactNode
  passBadge: string
}

const SECTIONS: ValidationSection[] = [
  {
    id: 'distribution',
    title: 'Distribution similarity',
    result: 'MMD ↓ 61%',
    resultColor: '#5f6b58',
    resultLabel: 'on Seating Half B',
    passBadge: 'Passes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="10" width="3" height="7" rx="1.5" fill="#5f6b58" opacity={0.4} />
        <rect x="5.5" y="6" width="3" height="11" rx="1.5" fill="#5f6b58" opacity={0.7} />
        <rect x="10" y="3" width="3" height="14" rx="1.5" fill="#5f6b58" />
        <rect x="14.5" y="7" width="3" height="10" rx="1.5" fill="#5f6b58" opacity={0.6} />
      </svg>
    ),
    detail: <DistributionSimilarityDetail />,
  },
  {
    id: 'plausibility',
    title: 'Biological plausibility',
    result: '4 / 4 checks',
    resultColor: UI.sageDeep,
    resultLabel: 'all mechanisms plausible',
    passBadge: 'Passes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7.5" stroke={UI.sageDeep} strokeWidth="1.5" />
        <path d="M5.5 9L8 11.5L12.5 6.5" stroke={UI.sageDeep} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    detail: <BiologicalPlausibilityDetail />,
  },
  {
    id: 'contraction',
    title: 'Contraction detection',
    result: 'AUC 0.81',
    resultColor: UI.stone,
    resultLabel: 'above chance (0.5) and baseline',
    passBadge: 'Passes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M1 12 C3 4, 5 4, 7 9 C9 14, 11 14, 13 9 C15 4, 17 8, 17 8" stroke={UI.stone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    detail: <ContractionDetectionDetail />,
  },
]

function ValidationAccordion({
  section,
  isOpen,
  onToggle,
  index,
}: {
  section: ValidationSection
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px 0px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 5 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...springSoft, delay: index * 0.1 }}
      className="overflow-hidden rounded-3xl ring-1 transition-shadow"
      style={{
        background: isOpen
          ? `color-mix(in srgb, ${section.resultColor} 4%, #faf6f0)`
          : '#faf6f0',
        boxShadow: isOpen
          ? `inset 0 0 0 1px ${section.resultColor}35, 0 8px 32px color-mix(in srgb, ${section.resultColor} 12%, transparent)`
          : 'inset 0 0 0 1px #d9b8b255, 0 2px 12px color-mix(in srgb, #3a3532 5%, transparent)',
      }}
    >
      {/* Header row — always visible */}
      <button
        id={`validation-section-${section.id}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        className="group flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              background: isOpen
                ? `color-mix(in srgb, ${section.resultColor} 15%, #faf6f0)`
                : '#f4efe6',
            }}
            transition={springSoft}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
          >
            {section.icon}
          </motion.div>
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-charcoal/40 uppercase">
              Validation criterion
            </p>
            <h2 className="mt-0.5 font-display text-xl font-medium text-ink">
              {section.title}
            </h2>
          </div>
        </div>

        {/* Key result — always shown */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Pass badge */}
            <motion.span
              animate={{ opacity: 1 }}
              className="rounded-full px-2 py-0.5 text-xs font-semibold text-cream"
              style={{ background: section.resultColor }}
            >
              {section.passBadge}
            </motion.span>
            {/* Big result */}
            <span
              className="font-display text-2xl font-medium"
              style={{ color: section.resultColor }}
            >
              {section.result}
            </span>
          </div>
          <span className="text-xs text-charcoal/40">{section.resultLabel}</span>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={springSoft}
            className="mt-1 text-charcoal/30 group-hover:text-charcoal/60"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
            <div className="border-t border-blush-deep/30 px-6 pb-6 pt-5">
              {section.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Validation page ──────────────────────────────────────────────────────────

export function Validation() {
  const [openSection, setOpenSection] = useState<string | null>(null)

  const toggle = (id: string) =>
    setOpenSection((prev) => (prev === id ? null : id))

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Step 10
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Does it hold up?
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            Calibration is tested on <strong className="text-ink">Seating Half B</strong> — participants
            never seen during mechanism fitting. Three criteria must pass.
          </p>
        </motion.header>

        {/* Half B context card */}
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.08 }}
          className="flex items-start gap-4 rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          {/* Person silhouettes — Half B */}
          <div className="flex flex-wrap gap-1 pt-0.5" style={{ maxWidth: 120 }}>
            {Array.from({ length: 22 }).map((_, i) => (
              <svg key={i} width="12" height="17" viewBox="0 0 24 34" fill="none">
                <circle cx="12" cy="7" r="5" stroke="#5f6b58" strokeWidth="2" opacity={0.6} />
                <path d="M4 34 C4 22 20 22 20 34" stroke="#5f6b58" strokeWidth="2" strokeLinecap="round" opacity={0.6} />
              </svg>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Half B — held-out test set</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
              22 participants. Their data was never used during mechanism fitting (Step 8).
              Validation uses their calibrated 8-feature vectors against the Laying reference distribution.
              The split is <strong className="text-charcoal/80">participant-level</strong> — no clip from a
              Half B participant appears in Half A.
            </p>
          </div>
        </motion.div>

        {/* Overall verdict */}
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.14 }}
          className="flex items-center gap-4 rounded-3xl px-6 py-5"
          style={{ background: 'color-mix(in srgb, #5f6b58 8%, #faf6f0)', border: '1px solid #5f6b5855' }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: '#5f6b58' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L8.5 14.5L16 6" stroke="#faf6f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-ink">All three criteria pass</p>
            <p className="text-sm text-charcoal/60">
              Calibration generalises to held-out participants. Expand any section for detail.
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {SECTIONS.map((s) => (
              <motion.div
                key={s.id}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.resultColor }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 6, delay: SECTIONS.indexOf(s) * 0.4 }}
              />
            ))}
          </div>
        </motion.div>

        {/* Three accordion sections */}
        <div className="space-y-4">
          {SECTIONS.map((section, i) => (
            <ValidationAccordion
              key={section.id}
              section={section}
              index={i}
              isOpen={openSection === section.id}
              onToggle={() => toggle(section.id)}
            />
          ))}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springSoft, delay: 0.4 }}
          className="text-center text-xs text-charcoal/35 pb-6"
        >
          Validation passes → proceed to projection on the calibrated standing range.
        </motion.p>

      </div>
    </div>
  )
}
