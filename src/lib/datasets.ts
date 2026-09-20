import { UI } from './palette'

export type HalfId = 'A' | 'B'

export interface Participant {
  id: string
  half: HalfId
  /** number of 1-min clips retained after processing */
  clips: number
}

// 45 participants: first 23 in Half A (tuning), remaining 22 in Half B (testing)
// Participant-level split — NOT clip-level.
const TOTAL = 45
export const PARTICIPANTS: Participant[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: `P${String(i + 1).padStart(2, '0')}`,
  half: i < 23 ? 'A' : 'B',
  clips: 4 + Math.round(Math.abs(Math.sin((i + 1) * 7.3)) * 6),
}))

export const HALF_A = PARTICIPANTS.filter((p) => p.half === 'A')
export const HALF_B = PARTICIPANTS.filter((p) => p.half === 'B')

export const SEATING_STATS = {
  name: 'Seating',
  subtitle: 'Real-world seated EHG',
  description:
    'Seated EHG recordings from real-world participants. Each participant contributes multiple 1-minute bipolar channel clips after filtering (0.2–3 Hz bandpass). The dataset is split at the participant level — never at the clip level — into two halves: Half A for mechanism tuning and Half B for held-out validation.',
  participants: TOTAL,
  totalClips: PARTICIPANTS.reduce((s, p) => s + p.clips, 0),
  channelConfig: 'Bipolar, 4-channel',
  bandpass: '0.2–3 Hz',
  clipDuration: '60 s',
  splitLabel: 'Participant-level',
  halfA: { label: 'Half A — Tuning', count: HALF_A.length },
  halfB: { label: 'Half B — Testing', count: HALF_B.length },
  color: UI.sageDeep,
  accentColor: UI.stone,
}

export const LAYING_STATS = {
  name: 'Laying',
  subtitle: 'Clinical, contraction-labelled EHG',
  description:
    'Clinical EHG recordings taken laying down, with expert-annotated uterine contraction events. Used as the calibration target distribution — the signal we transform the Seating data toward. Contraction segments are labelled, enabling spectral feature comparison against the seated real-world baseline.',
  participants: 30,
  totalClips: 214,
  channelConfig: 'Bipolar, 4-channel',
  bandpass: '0.2–3 Hz',
  clipDuration: '30–90 s',
  splitLabel: 'Contraction-labelled',
  contractionClips: 102,
  baselineClips: 112,
  color: UI.stone,
  accentColor: UI.stoneSoft,
}

export type DatasetId = 'seating' | 'laying'

export const DATASET_STATS = {
  seating: SEATING_STATS,
  laying: LAYING_STATS,
} as const
