import { BACKEND_RESULTS } from './backendResults.generated'
import { channelRms, formatAmp } from './mechanismRanges'

const demo = BACKEND_RESULTS.calibration.sittingDemo

/** Real TPEHGT lying window used as the Home inject base. */
export const LYING_WINDOW = {
  rms: channelRms(demo.lyingTrace),
  recordId: demo.sourceRecordId,
  fs: demo.fs,
  durationSeconds: demo.durationSeconds,
} as const

/** Same window after sitting calibration — standing starts from this. */
export const SEATED_WINDOW = {
  rms: channelRms(demo.calibratedTrace),
  recordId: demo.sourceRecordId,
  fs: demo.fs,
  durationSeconds: demo.durationSeconds,
} as const

function windowCaption(label: string, window: typeof LYING_WINDOW) {
  const seconds = Math.round(window.durationSeconds)
  return `${label} RMS ${formatAmp(window.rms)} · ${window.recordId} · ${seconds} s at ${window.fs} Hz`
}

export function lyingWindowCaption() {
  return windowCaption('Lying window', LYING_WINDOW)
}

export function seatedWindowCaption() {
  return windowCaption('Seated window', SEATED_WINDOW)
}
