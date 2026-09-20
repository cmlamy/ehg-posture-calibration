import {
  CLINICAL_WEIGHTS,
  MECHANISM_IDS,
  MECHANISMS,
  TARGET_WEIGHTS,
  type Weights,
} from './mechanisms'
import { mixSample } from './signal'

// ─── Simulation constants ────────────────────────────────────────────────────

export const N_SAMPLES = 120 // points per trace
export const N_SIMS = 64 // number of simulated outcomes
export const SPLIT = 0.38 // fraction of x-axis that is "sitting"
export const BLEND = 0.06 // fraction of x-axis spent transitioning

/** How fast the trace drifts through time. Lower is calmer. */
export const DRIFT = 0.06

/**
 * The three postures the chart can show. `laying` is the resting clinical
 * recording position, `sitting` is the calibrated real-world signal, and
 * `standing` is the simulated projection off the sitting baseline.
 */
export type PosturePhase = 'laying' | 'sitting' | 'standing'

/** Resting baseline — the laying-down clinical recording mix. */
export const LAYING_WEIGHTS = CLINICAL_WEIGHTS
/** Calibrated sitting mix — what the pipeline validates against. */
export const SITTING_WEIGHTS = TARGET_WEIGHTS

/** Blend two mixes. `t = 0` is `from`, `t = 1` is `to`. */
export function lerpWeights(from: Weights, to: Weights, t: number): Weights {
  const u = Math.max(0, Math.min(1, t))
  const next = { ...from }
  for (const id of MECHANISM_IDS) {
    next[id] = from[id] + (to[id] - from[id]) * u
  }
  return next
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(1664525, s) + 1013904223
    return (s >>> 0) / 4294967296
  }
}

// ─── Literature-derived postural change ranges ───────────────────────────────

export const POSTURAL_FACTORS = [
  {
    id: 'hr',
    label: 'Maternal HR',
    description:
      'Standing increases maternal heart rate 8–18 bpm, elevating heartbeat artefact amplitude in abdominal EHG.',
    rangeLow: +0.08,
    rangeHigh: +0.22,
    color: MECHANISMS.heartbeat.color,
  },
  {
    id: 'breath',
    label: 'Breathing depth',
    description:
      'Orthostatic shift reduces tidal volume ~12–20%; respiratory influence on EHG decreases proportionally.',
    rangeLow: -0.2,
    rangeHigh: -0.1,
    color: MECHANISMS.breathing.color,
  },
  {
    id: 'muscle',
    label: 'Postural muscle tone',
    description:
      'Standing engages core musculature, increasing EMG baseline 15–35% above seated.',
    rangeLow: +0.15,
    rangeHigh: +0.35,
    color: MECHANISMS.muscle.color,
  },
  {
    id: 'fetal',
    label: 'Fetal position',
    description:
      'Gravity shifts fetal position in standing; movement artefact amplitude changes −5% to +20%.',
    rangeLow: -0.05,
    rangeHigh: +0.2,
    color: MECHANISMS.fetal.color,
  },
]

// ─── Outcomes ────────────────────────────────────────────────────────────────

export interface SimOutcome {
  id: number
  hrShift: number
  breathShift: number
  muscleShift: number
  fetalShift: number
  /** Scalar amplitude modifier for the standing portion */
  amplitudeMod: number
  /** Phase offset for the standing portion */
  phaseOff: number
  /** Frequency stretch */
  freqMod: number
}

export function generateOutcomes(seed: number): SimOutcome[] {
  const rand = lcg(seed)
  return Array.from({ length: N_SIMS }, (_, i) => {
    const lerp = (lo: number, hi: number) => lo + rand() * (hi - lo)
    return {
      id: i,
      hrShift: lerp(POSTURAL_FACTORS[0].rangeLow, POSTURAL_FACTORS[0].rangeHigh),
      breathShift: lerp(POSTURAL_FACTORS[1].rangeLow, POSTURAL_FACTORS[1].rangeHigh),
      muscleShift: lerp(POSTURAL_FACTORS[2].rangeLow, POSTURAL_FACTORS[2].rangeHigh),
      fetalShift: lerp(POSTURAL_FACTORS[3].rangeLow, POSTURAL_FACTORS[3].rangeHigh),
      amplitudeMod: 0.78 + rand() * 0.52,
      phaseOff: rand() * 2.4,
      freqMod: 0.88 + rand() * 0.26,
    }
  })
}

export function standingWeights(outcome: SimOutcome): Weights {
  return {
    heartbeat: Math.max(0.01, SITTING_WEIGHTS.heartbeat * (1 + outcome.hrShift)),
    breathing: Math.max(0.01, SITTING_WEIGHTS.breathing * (1 + outcome.breathShift)),
    muscle: Math.max(0.01, SITTING_WEIGHTS.muscle * (1 + outcome.muscleShift)),
    fetal: Math.max(0.01, SITTING_WEIGHTS.fetal * (1 + outcome.fetalShift)),
    // Instrumentation, not physiology — posture carries no literature range for
    // it, so the electrode contribution is held at its calibrated level.
    electrode: SITTING_WEIGHTS.electrode,
  }
}

function normalizeWeights(weights: Weights): Weights {
  let sum = 0
  for (const id of MECHANISM_IDS) sum += weights[id]
  const next = { ...weights }
  if (sum <= 0) return next
  for (const id of MECHANISM_IDS) next[id] = weights[id] / sum
  return next
}

/**
 * Midpoint of the literature postural shifts, applied to the seated mix and
 * renormalised. The sliders ease toward this when the chart is in standing.
 */
export const STANDING_WEIGHTS: Weights = normalizeWeights({
  heartbeat: SITTING_WEIGHTS.heartbeat * 1.15,
  breathing: SITTING_WEIGHTS.breathing * 0.85,
  muscle: SITTING_WEIGHTS.muscle * 1.25,
  fetal: SITTING_WEIGHTS.fetal * 1.075,
  electrode: SITTING_WEIGHTS.electrode,
})

// ─── Traces ──────────────────────────────────────────────────────────────────

/** A single posture held across the whole width — used for laying and sitting. */
export function postureTrace(weights: Weights, phase: number): number[] {
  return Array.from({ length: N_SAMPLES }, (_, i) => {
    const t = phase * DRIFT + (i / (N_SAMPLES - 1)) * 10
    return mixSample(weights, t)
  })
}

/** Sitting portion, then a blended transition into the standing portion. */
export function buildSimTrace(outcome: SimOutcome, phase: number): number[] {
  const standW = standingWeights(outcome)
  return Array.from({ length: N_SAMPLES }, (_, i) => {
    const frac = i / (N_SAMPLES - 1)
    const t = phase * DRIFT + frac * 10
    const seated = mixSample(SITTING_WEIGHTS, t)
    if (frac < SPLIT) return seated
    const blend = Math.min(1, (frac - SPLIT) / BLEND)
    const standing =
      mixSample(standW, t * outcome.freqMod + outcome.phaseOff) * outcome.amplitudeMod
    return seated * (1 - blend) + standing * blend
  })
}

function rms(values: number[]) {
  if (values.length === 0) return 0
  let sum = 0
  for (const v of values) sum += v * v
  return Math.sqrt(sum / values.length)
}

/**
 * Standing amplitude as a multiple of sitting. Both signals are measured over
 * the same time window so the ratio reflects the postural shift rather than
 * which bursts happen to fall inside a slice of the trace.
 */
export function standingRatio(outcome: SimOutcome) {
  const standW = standingWeights(outcome)
  const seated: number[] = []
  const standing: number[] = []
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = (i / (N_SAMPLES - 1)) * 10
    seated.push(mixSample(SITTING_WEIGHTS, t))
    standing.push(
      mixSample(standW, t * outcome.freqMod + outcome.phaseOff) * outcome.amplitudeMod,
    )
  }
  const base = rms(seated)
  return base === 0 ? 1 : rms(standing) / base
}
