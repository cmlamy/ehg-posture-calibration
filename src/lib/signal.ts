import {
  CLINICAL_WEIGHTS,
  MECHANISM_IDS,
  TARGET_WEIGHTS,
  type MechanismId,
  type Weights,
} from './mechanisms'

export const SAMPLE_COUNT = 168

/**
 * Seconds of trace time that pass per real second. Every animated waveform
 * scales its clock by this so the whole app drifts at one calm speed.
 */
export const PHASE_RATE = 0.08

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453123
  return s - Math.floor(s)
}

function valueNoise(t: number) {
  const i = Math.floor(t)
  const f = t - i
  const a = hash(i)
  const b = hash(i + 1)
  const u = f * f * (3 - 2 * f)
  return a * (1 - u) + b * u
}

function pulseTrain(t: number, bpm: number, width: number) {
  const period = 60 / bpm
  const phase = ((t % period) + period) % period
  const peak = period * 0.18
  return Math.exp(-((phase - peak) ** 2) / (2 * width * width))
}

function fetalBursts(t: number) {
  const a = Math.exp(-(((t % 6.4) - 1.15) ** 2) / 0.08)
  const b = Math.exp(-(((t % 9.1) - 4.4) ** 2) / 0.12)
  return a * 0.85 + b * 0.55
}

export function mechanismSample(id: MechanismId, t: number) {
  switch (id) {
    case 'heartbeat':
      return pulseTrain(t, 78, 0.045) * 2.15 - 0.25
    case 'breathing':
      return Math.sin(t * Math.PI * 2 * 0.26) * 0.92 + Math.sin(t * 0.41) * 0.08
    case 'muscle':
      return (valueNoise(t * 14.2) - 0.5) * 1.6 + Math.sin(t * 19.4) * 0.22
    case 'fetal':
      return fetalBursts(t) * 1.7 - 0.12
    case 'electrode':
      // Instrumentation rather than physiology: slow baseline wander from
      // electrode contact, plus a little low-frequency drift noise.
      return (
        Math.sin(t * 2.05) * 0.86 +
        Math.sin(t * 5.4 + 0.6) * 0.34 +
        (valueNoise(t * 3.1) - 0.5) * 0.4
      )
  }
}

export function mixSample(weights: Weights, t: number) {
  let y = 0
  for (const id of MECHANISM_IDS) {
    y += weights[id] * mechanismSample(id, t)
  }
  return y
}

export function buildTrace(
  sample: (t: number) => number,
  phase: number,
  seconds = 8,
) {
  const out = new Array<number>(SAMPLE_COUNT)
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = phase * 0.22 + (i / (SAMPLE_COUNT - 1)) * seconds
    out[i] = sample(t)
  }
  return out
}

export function tracesFromWeights(weights: Weights, phase: number) {
  const mechanisms = Object.fromEntries(
    MECHANISM_IDS.map((id) => [
      id,
      buildTrace((t) => weights[id] * mechanismSample(id, t), phase),
    ]),
  ) as Record<MechanismId, number[]>
  const combined = buildTrace((t) => mixSample(weights, t), phase)
  const clinical = buildTrace((t) => mixSample(CLINICAL_WEIGHTS, t), phase)
  const target = buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase)
  return { mechanisms, combined, clinical, target }
}

/**
 * Mock 8-D spectral feature vector driven only by the mechanism mix.
 * The electrode term loads mainly on the low-frequency bands and RMS, which is
 * where baseline wander from contact drift shows up in real EHG.
 */
export function eightFeatures(weights: Weights) {
  const { heartbeat: h, breathing: b, muscle: m, fetal: f, electrode: e } = weights
  return [
    0.18 + 0.72 * h + 0.08 * b + 0.05 * e,
    0.12 + 0.78 * b + 0.1 * f + 0.03 * e,
    0.2 + 0.55 * b + 0.2 * h + 0.36 * e,
    0.16 + 0.48 * h + 0.22 * f + 0.14 * e,
    0.14 + 0.5 * m + 0.18 * h + 0.06 * e,
    0.1 + 0.62 * m + 0.12 * f + 0.03 * e,
    0.22 + 0.4 * f + 0.18 * b + 0.19 * e,
    0.15 + 0.28 * h + 0.24 * b + 0.22 * m + 0.2 * f + 0.18 * e,
  ]
}

export function mmdDistance(weights: Weights) {
  const a = eightFeatures(weights)
  const b = eightFeatures(TARGET_WEIGHTS)
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function compositionShares(weights: Weights) {
  const total = MECHANISM_IDS.reduce((s, id) => s + weights[id], 0) || 1
  return MECHANISM_IDS.map((id) => ({
    id,
    value: (weights[id] / total) * 100,
  }))
}

function shareMap(weights: Weights) {
  const out = {} as Record<MechanismId, number>
  for (const { id, value } of compositionShares(weights)) out[id] = value
  return out
}

export type CompositionDelta = {
  id: MechanismId
  before: number
  after: number
  target: number
  /** after − before, in percentage points */
  delta: number
  /** |after − target|, in percentage points — how far this share still is from target */
  gap: number
}

/** Per-mechanism before → after share comparison, all in percent. */
export function compositionDeltas(before: Weights, after: Weights): CompositionDelta[] {
  const b = shareMap(before)
  const a = shareMap(after)
  const t = shareMap(TARGET_WEIGHTS)
  return MECHANISM_IDS.map((id) => ({
    id,
    before: b[id],
    after: a[id],
    target: t[id],
    delta: a[id] - b[id],
    gap: Math.abs(a[id] - t[id]),
  }))
}

/**
 * Total variation distance between two mixes, in percentage points: the share
 * of the mix that had to be redistributed to get from one to the other.
 */
export function compositionShift(from: Weights, to: Weights) {
  const a = shareMap(from)
  const b = shareMap(to)
  let sum = 0
  for (const id of MECHANISM_IDS) sum += Math.abs(b[id] - a[id])
  return sum / 2
}

/** How closely a mix matches the target composition, 0–100%. */
export function targetMatch(weights: Weights) {
  return 100 - compositionShift(weights, TARGET_WEIGHTS)
}

export function pathFromSamples(
  samples: number[],
  width: number,
  height: number,
  padY = 0.12,
) {
  if (samples.length === 0) return ''
  let min = samples[0]
  let max = samples[0]
  for (const y of samples) {
    if (y < min) min = y
    if (y > max) max = y
  }
  const span = max - min || 1
  const usable = height * (1 - padY * 2)
  const step = width / (samples.length - 1)
  let d = ''
  for (let i = 0; i < samples.length; i++) {
    const x = i * step
    const y = height * padY + (1 - (samples[i] - min) / span) * usable
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d
}
