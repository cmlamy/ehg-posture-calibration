import type { DatasetId } from './datasets'
import { UI } from './palette'

export type LogDatasetId = DatasetId | 'both'

export const ACTION_IDS = [
  'load',
  'filter',
  'features',
  'loudness',
  'calibrate',
  'validate',
  'project',
  'export',
] as const

export type ActionId = (typeof ACTION_IDS)[number]

// Actions are not mechanisms, so they take structural neutrals and are
// distinguished by glyph and label rather than by hue alone.
export const ACTIONS: Record<ActionId, { label: string; glyph: string; color: string }> = {
  load: { label: 'Load dataset', glyph: '⬡', color: UI.charcoal },
  filter: { label: 'Signal processing', glyph: '⌇', color: UI.sageDeep },
  features: { label: 'Feature extraction', glyph: '⋮⋮', color: UI.stone },
  loudness: { label: 'Loudness correction', glyph: '◐', color: UI.stoneSoft },
  calibrate: { label: 'Fit mechanisms', glyph: '◎', color: UI.charcoal },
  validate: { label: 'Validate', glyph: '✓', color: UI.sageDeep },
  project: { label: 'Project to standing', glyph: '→', color: UI.stone },
  export: { label: 'Export', glyph: '⤓', color: UI.stoneSoft },
}

export const DATASET_LABELS: Record<LogDatasetId, string> = {
  seating: 'Seating',
  laying: 'Laying',
  both: 'Seating + Laying',
}

export interface LogEntry {
  id: string
  /** ISO timestamp */
  at: string
  action: ActionId
  dataset: LogDatasetId
  /** Short headline shown on the collapsed row */
  summary: string
  parameters: Record<string, string>
  result: string
  /** Optional headline metric surfaced on the collapsed row */
  metric?: { label: string; value: string }
  note?: string
}

/**
 * Placeholder lab notebook. Newest first — the page keeps this order.
 */
export const LOG_ENTRIES: LogEntry[] = [
  {
    id: 'e18',
    at: '2026-09-19T20:41:00',
    action: 'export',
    dataset: 'both',
    summary: 'Exported calibration run bundle',
    parameters: {
      Format: 'CSV + JSON',
      Contents: 'Weights, 8 features, MMD history',
      Runs: '3',
    },
    result: 'Bundle written — 3 runs, 412 KB',
  },
  {
    id: 'e17',
    at: '2026-09-19T19:58:00',
    action: 'project',
    dataset: 'seating',
    summary: 'Projected seated → standing',
    parameters: {
      Simulations: '64',
      Seed: '2718',
      'HR shift': '+8% to +22%',
      'Breathing shift': '−20% to −10%',
      'Muscle tone shift': '+15% to +35%',
      'Fetal shift': '−5% to +20%',
    },
    result: 'Standing amplitude 0.77× – 1.17× of seated (10th–90th pct), median 0.97×',
    metric: { label: 'Median', value: '0.97×' },
    note: 'Reported as a range. A single predicted line would overstate confidence.',
  },
  {
    id: 'e16',
    at: '2026-09-19T18:22:00',
    action: 'validate',
    dataset: 'seating',
    summary: 'Contraction detection on Half B',
    parameters: {
      Split: 'Half B (held out)',
      Participants: '22',
      Threshold: 'RMS > 1.4σ',
    },
    result: 'Detection F1 0.81 · precision 0.84 · recall 0.78',
    metric: { label: 'F1', value: '0.81' },
  },
  {
    id: 'e15',
    at: '2026-09-19T17:47:00',
    action: 'validate',
    dataset: 'seating',
    summary: 'Biological plausibility check',
    parameters: {
      Split: 'Half B (held out)',
      Checks: 'HR band, breathing rate, burst rate',
    },
    result: 'All four mechanisms within physiological bounds',
  },
  {
    id: 'e14',
    at: '2026-09-19T17:03:00',
    action: 'validate',
    dataset: 'both',
    summary: 'Distribution similarity on held-out half',
    parameters: {
      Split: 'Half B (held out)',
      Metric: 'MMD, RBF kernel',
      Bandwidth: 'Median heuristic',
    },
    result: 'MMD 0.043 on Half B vs 0.038 on Half A — generalises',
    metric: { label: 'MMD', value: '0.043' },
    note: 'Gap to Half A is small enough that the fit is not memorising Half A participants.',
  },
  {
    id: 'e13',
    at: '2026-09-19T16:15:00',
    action: 'calibrate',
    dataset: 'both',
    summary: 'Mechanism fit converged',
    parameters: {
      Heartbeat: '0.24',
      Breathing: '0.41',
      Muscle: '0.14',
      Fetal: '0.21',
      Iterations: '148',
      Optimiser: 'Nelder–Mead',
    },
    result: 'MMD 0.038 — converged after 148 iterations',
    metric: { label: 'MMD', value: '0.038' },
  },
  {
    id: 'e12',
    at: '2026-09-19T15:38:00',
    action: 'calibrate',
    dataset: 'both',
    summary: 'Restarted fit with wider muscle bound',
    parameters: {
      'Muscle bound': '0.05 – 0.45',
      Restarts: '4',
      Seed: '1041',
    },
    result: 'MMD 0.052 — improved on previous 0.061',
    metric: { label: 'MMD', value: '0.052' },
    note: 'Earlier bound of 0.30 was clipping the optimum.',
  },
  {
    id: 'e11',
    at: '2026-09-19T14:52:00',
    action: 'calibrate',
    dataset: 'both',
    summary: 'First mechanism fit',
    parameters: {
      Init: 'Clinical weights',
      Iterations: '96',
      Optimiser: 'Nelder–Mead',
    },
    result: 'MMD 0.061 — stalled against muscle upper bound',
    metric: { label: 'MMD', value: '0.061' },
  },
  {
    id: 'e10',
    at: '2026-09-19T13:20:00',
    action: 'loudness',
    dataset: 'laying',
    summary: 'Applied loudness correction',
    parameters: {
      'Dataset ratio': '1.34×',
      Reference: 'Laying RMS',
      Scope: 'All clips',
    },
    result: 'Amplitude scale corrected — equipment gain difference removed',
    metric: { label: 'Ratio', value: '1.34×' },
    note: 'Equipment correction, not a fitted mechanism. Applied before calibration.',
  },
  {
    id: 'e09',
    at: '2026-09-18T19:05:00',
    action: 'features',
    dataset: 'both',
    summary: 'Extracted 8 spectral features',
    parameters: {
      Features: 'F0, F1, P0.3, P0.8, P1.4, P2.2, Entropy, RMS',
      Window: '60 s',
      Overlap: '50%',
    },
    result: '576 feature vectors written',
  },
  {
    id: 'e08',
    at: '2026-09-18T18:12:00',
    action: 'features',
    dataset: 'seating',
    summary: 'Feature sanity pass',
    parameters: {
      Check: 'NaN / inf scan',
      Vectors: '331',
    },
    result: '3 vectors dropped for clipping artefacts',
  },
  {
    id: 'e07',
    at: '2026-09-18T16:44:00',
    action: 'filter',
    dataset: 'laying',
    summary: 'Bandpass + clip segmentation',
    parameters: {
      Bandpass: '0.2–3 Hz',
      Channels: 'Bipolar, 4-channel',
      'Clip length': '30–90 s',
    },
    result: '214 clips retained',
  },
  {
    id: 'e06',
    at: '2026-09-18T16:02:00',
    action: 'filter',
    dataset: 'seating',
    summary: 'Bandpass + clip segmentation',
    parameters: {
      Bandpass: '0.2–3 Hz',
      Channels: 'Bipolar, 4-channel',
      'Clip length': '60 s',
    },
    result: '331 clips retained, 18 rejected for motion artefact',
  },
  {
    id: 'e05',
    at: '2026-09-18T14:30:00',
    action: 'filter',
    dataset: 'seating',
    summary: 'Rejected 0.05 Hz high-pass variant',
    parameters: {
      Bandpass: '0.05–3 Hz',
      Reason: 'Baseline wander retained',
    },
    result: 'Discarded — drift dominated the low band',
    note: 'Kept for the record so the 0.2 Hz choice is traceable.',
  },
  {
    id: 'e04',
    at: '2026-09-17T11:48:00',
    action: 'load',
    dataset: 'laying',
    summary: 'Loaded Laying clinical recordings',
    parameters: {
      Participants: '30',
      'Contraction clips': '102',
      'Baseline clips': '112',
    },
    result: '214 clips indexed',
  },
  {
    id: 'e03',
    at: '2026-09-17T11:20:00',
    action: 'load',
    dataset: 'seating',
    summary: 'Confirmed participant-level split',
    parameters: {
      'Half A': '23 participants (tuning)',
      'Half B': '22 participants (testing)',
      Method: 'Participant-level',
    },
    result: 'No participant appears in both halves',
    note: 'Split is by woman, never by clip — clip-level leakage would inflate validation.',
  },
  {
    id: 'e02',
    at: '2026-09-17T10:55:00',
    action: 'load',
    dataset: 'seating',
    summary: 'Loaded Seating seated recordings',
    parameters: {
      Participants: '45',
      Posture: 'Seated',
      Source: 'Real-world',
    },
    result: '349 raw clips indexed',
  },
  {
    id: 'e01',
    at: '2026-09-17T10:30:00',
    action: 'load',
    dataset: 'both',
    summary: 'Opened calibration study',
    parameters: {
      Study: 'EHG seated calibration',
      Sources: 'Seating, Laying',
    },
    result: 'Workspace initialised',
  },
]

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DAY_NOTES_KEY = 'vera-research-day-notes'

export function loadDayNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DAY_NOTES_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const notes: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') notes[key] = value
    }
    return notes
  } catch {
    return {}
  }
}

export function saveDayNote(key: string, note: string) {
  const notes = loadDayNotes()
  if (note.trim() === '') delete notes[key]
  else notes[key] = note
  localStorage.setItem(DAY_NOTES_KEY, JSON.stringify(notes))
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function toCsv(entries: LogEntry[]) {
  const header = ['Timestamp', 'Action', 'Dataset', 'Summary', 'Parameters', 'Result', 'Note']
  const rows = entries.map((e) =>
    [
      e.at,
      ACTIONS[e.action].label,
      DATASET_LABELS[e.dataset],
      e.summary,
      Object.entries(e.parameters)
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
      e.result,
      e.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.map(csvCell).join(','), ...rows].join('\n')
}

export function toJson(entries: LogEntry[]) {
  return JSON.stringify(
    entries.map((e) => ({
      timestamp: e.at,
      action: ACTIONS[e.action].label,
      dataset: DATASET_LABELS[e.dataset],
      summary: e.summary,
      parameters: e.parameters,
      result: e.result,
      ...(e.note ? { note: e.note } : {}),
    })),
    null,
    2,
  )
}
