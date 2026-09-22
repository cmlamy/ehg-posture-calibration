import type { MechanismId } from './mechanisms'

/**
 * Simulator caps from configs/default.json (exploratory profile) and Icelandic
 * nested-CV selected strengths from results/nested-cv-quick/report.md.
 *
 * Strength 0–1 scales the artefact. The testable amplitude is
 * strength × max_artifact_rms_ratio × channel RMS (see simulator.py).
 */
export const SIMULATOR_CAPS = {
  heartbeat: { bpmLow: 84, bpmHigh: 90, maxRms: 0.45 },
  breathing: { bpm: 16, maxRms: 0.35 },
  muscle: { burstsPerMin: 3, durationLow: 0.5, durationHigh: 4, maxRms: 0.65 },
  fetal: { eventsPerMin: 4, durationLow: 0.4, durationHigh: 2.5, maxRms: 0.55 },
  electrode: { maxGainChange: 0.25, maxCrosstalk: 0.15, maxRms: 0.2 },
} as const

export function channelRms(samples: readonly number[]) {
  if (samples.length === 0) return 0
  let sum = 0
  for (const x of samples) sum += x
  const mean = sum / samples.length
  let acc = 0
  for (const x of samples) {
    const d = x - mean
    acc += d * d
  }
  return Math.sqrt(acc / samples.length)
}

export function formatAmp(n: number) {
  if (!Number.isFinite(n) || n === 0) return '0'
  return Number(n.toPrecision(3)).toString()
}

export const MECHANISM_RANGES: Record<
  MechanismId,
  { icelandicLow: number; icelandicHigh: number; icelandicMean: number }
> = {
  heartbeat: { icelandicLow: 0.0198, icelandicHigh: 0.1191, icelandicMean: 0.0862 },
  breathing: { icelandicLow: 0.0377, icelandicHigh: 0.7408, icelandicMean: 0.3111 },
  muscle: { icelandicLow: 0.1764, icelandicHigh: 0.9161, icelandicMean: 0.5604 },
  fetal: { icelandicLow: 0.0461, icelandicHigh: 0.8525, icelandicMean: 0.5322 },
  electrode: { icelandicLow: 0.9198, icelandicHigh: 0.9782, icelandicMean: 0.9526 },
}

function rmsPct(strength: number, cap: number) {
  const n = Math.max(0, strength) * cap * 100
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

function gainBounds(strength: number) {
  const delta = SIMULATOR_CAPS.electrode.maxGainChange * Math.max(0, strength)
  return { low: 1 - delta, high: 1 + delta }
}

export function rangePercent(id: MechanismId) {
  const range = MECHANISM_RANGES[id]
  return {
    low: Math.round(range.icelandicLow * 100),
    high: Math.round(range.icelandicHigh * 100),
    mean: Math.round(range.icelandicMean * 100),
  }
}

function ofLyingRms(strength: number, cap: number, lyingRms?: number) {
  const pct = `${rmsPct(strength, cap)}% of the lying channel RMS`
  if (lyingRms == null) return pct
  return `${pct} (${formatAmp(Math.max(0, strength) * cap * lyingRms)} on this window)`
}

/** Simulator engineering cap for this factor, optionally as amplitude on a lying window. */
export function assumedMaxLine(id: MechanismId, lyingRms?: number) {
  const cap = SIMULATOR_CAPS[id].maxRms
  const pct = Math.round(cap * 100)
  const abs = lyingRms != null ? ` · ${formatAmp(cap * lyingRms)} on this window` : ''
  if (id === 'electrode') {
    const e = SIMULATOR_CAPS.electrode
    return `Assumed maximum ${pct}% of lying RMS${abs} · gain ±${Math.round(e.maxGainChange * 100)}% · crosstalk ${Math.round(e.maxCrosstalk * 100)}% · engineering cap`
  }
  return `Assumed maximum ${pct}% of lying RMS${abs} · engineering cap`
}

/** Physical quantities a lab can inject at the current slider strength. */
export function testProtocol(id: MechanismId, strength: number, lyingRms?: number) {
  const folds = MECHANISM_RANGES[id]
  const assumedMax = assumedMaxLine(id, lyingRms)
  switch (id) {
    case 'heartbeat': {
      const cap = SIMULATOR_CAPS.heartbeat
      return {
        assumedMax,
        test: `${cap.bpmLow}–${cap.bpmHigh} bpm at ${ofLyingRms(strength, cap.maxRms, lyingRms)}`,
        folds: `Seated Icelandic window ${rmsPct(folds.icelandicLow, cap.maxRms)}–${rmsPct(folds.icelandicHigh, cap.maxRms)}% RMS`,
      }
    }
    case 'breathing': {
      const cap = SIMULATOR_CAPS.breathing
      return {
        assumedMax,
        test: `${cap.bpm} breaths/min at ${ofLyingRms(strength, cap.maxRms, lyingRms)}`,
        folds: `Seated Icelandic window ${rmsPct(folds.icelandicLow, cap.maxRms)}–${rmsPct(folds.icelandicHigh, cap.maxRms)}% RMS`,
      }
    }
    case 'muscle': {
      const cap = SIMULATOR_CAPS.muscle
      return {
        assumedMax,
        test: `Up to ${cap.burstsPerMin} bursts/min, ${cap.durationLow}–${cap.durationHigh} s, ${ofLyingRms(strength, cap.maxRms, lyingRms)}`,
        folds: `Seated Icelandic window ${rmsPct(folds.icelandicLow, cap.maxRms)}–${rmsPct(folds.icelandicHigh, cap.maxRms)}% RMS`,
      }
    }
    case 'fetal': {
      const cap = SIMULATOR_CAPS.fetal
      return {
        assumedMax,
        test: `Up to ${cap.eventsPerMin} events/min, ${cap.durationLow}–${cap.durationHigh} s, ${ofLyingRms(strength, cap.maxRms, lyingRms)}`,
        folds: `Seated Icelandic window ${rmsPct(folds.icelandicLow, cap.maxRms)}–${rmsPct(folds.icelandicHigh, cap.maxRms)}% RMS`,
      }
    }
    case 'electrode': {
      const cap = SIMULATOR_CAPS.electrode
      const gain = gainBounds(strength)
      const foldGain = gainBounds(folds.icelandicLow)
      const foldGainHigh = gainBounds(folds.icelandicHigh)
      return {
        assumedMax,
        test: `On the lying trace: gain ×${gain.low.toFixed(2)}–${gain.high.toFixed(2)} · crosstalk ${(strength * cap.maxCrosstalk * 100).toFixed(0)}% · noise ${ofLyingRms(strength, cap.maxRms, lyingRms)}`,
        folds: `Seated Icelandic gain ×${foldGain.low.toFixed(2)}–${foldGainHigh.high.toFixed(2)}`,
      }
    }
  }
}
