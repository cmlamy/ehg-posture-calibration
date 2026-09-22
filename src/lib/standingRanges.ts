import { BACKEND_RESULTS } from './backendResults.generated'
import { formatAmp, SIMULATOR_CAPS } from './mechanismRanges'
import { SEATED_WINDOW } from './lyingWindow'

/**
 * Start-testing ranges from configs/standing_projection.json and the nested-CV
 * standing run (results/standing-nested-cv-full). Projected, not validated.
 */
export const STANDING_TEST = {
  heartMultiplier: { low: 1.0, high: 1.3 },
  electrodeJumpMinRms: 0.2,
  electrodeJumpTypicalRms: 3.3,
  electrodeQuietPerHour: { low: 49, high: 58 },
  electrodeMovementPerHour: { low: 92, high: 134 },
  electrodeDecaySeconds: { low: 0.25, high: 10 },
  walkingCadence: { low: 80, high: 120 },
} as const

function rmsPct(strength: number, cap: number) {
  const n = Math.max(0, strength) * cap * 100
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

export function standingTestCards(seatedRms = SEATED_WINDOW.rms) {
  const heart = SIMULATOR_CAPS.heartbeat
  const strength = BACKEND_RESULTS.calibration.fittedParameters.heartbeat
  const standingLow = Math.round(heart.bpmLow * STANDING_TEST.heartMultiplier.low)
  const standingHigh = Math.round(heart.bpmHigh * STANDING_TEST.heartMultiplier.high)
  const injectFrac = strength * heart.maxRms
  const jumpMin = STANDING_TEST.electrodeJumpMinRms * seatedRms
  const jumpTypical = STANDING_TEST.electrodeJumpTypicalRms * seatedRms

  return [
    {
      id: 'heartbeat' as const,
      name: 'Maternal Heartbeat',
      test: `${standingLow}–${standingHigh} bpm (${STANDING_TEST.heartMultiplier.low.toFixed(1)}–${STANDING_TEST.heartMultiplier.high.toFixed(1)}× seated ${heart.bpmLow}–${heart.bpmHigh})`,
      detail: `Keep seated amplitude ${rmsPct(strength, heart.maxRms)}% of seated RMS (${formatAmp(injectFrac * seatedRms)} on this window)`,
    },
    {
      id: 'electrode' as const,
      name: 'Electrode shift',
      test: `Jumps from ${Math.round(STANDING_TEST.electrodeJumpMinRms * 100)}% of seated RMS (${formatAmp(jumpMin)}) · typical ${STANDING_TEST.electrodeJumpTypicalRms}× (${formatAmp(jumpTypical)})`,
      detail: `${STANDING_TEST.electrodeQuietPerHour.low}–${STANDING_TEST.electrodeQuietPerHour.high}/hour quiet · ${STANDING_TEST.electrodeMovementPerHour.low}–${STANDING_TEST.electrodeMovementPerHour.high}/hour movement · decay ${STANDING_TEST.electrodeDecaySeconds.low}–${STANDING_TEST.electrodeDecaySeconds.high} s`,
    },
    {
      id: 'walking' as const,
      name: 'Walking',
      test: `${STANDING_TEST.walkingCadence.low}–${STANDING_TEST.walkingCadence.high} steps/min`,
      detail: 'Same electrode jumps, timed to steps · not measured walking EHG',
    },
  ]
}
