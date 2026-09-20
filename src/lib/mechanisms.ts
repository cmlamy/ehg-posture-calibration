export const MECHANISM_IDS = [
  'heartbeat',
  'breathing',
  'muscle',
  'fetal',
  'electrode',
] as const

export type MechanismId = (typeof MECHANISM_IDS)[number]

export type Weights = Record<MechanismId, number>

export const MECHANISMS: Record<
  MechanismId,
  {
    id: MechanismId
    name: string
    short: string
    color: string
    dash: string
    icon: 'heart' | 'breath' | 'muscle' | 'fetal' | 'electrode'
    /** False for the electrode signal, which is instrumentation, not physiology. */
    physiological: boolean
  }
> = {
  heartbeat: {
    id: 'heartbeat',
    name: 'Maternal Heartbeat',
    short: 'Heartbeat',
    color: '#c47865',
    dash: '',
    icon: 'heart',
    physiological: true,
  },
  breathing: {
    id: 'breathing',
    name: 'Breathing',
    short: 'Breathing',
    color: '#7d8b74',
    dash: '7 5',
    icon: 'breath',
    physiological: true,
  },
  muscle: {
    id: 'muscle',
    name: 'Muscle Noise',
    short: 'Muscle',
    color: '#8a6d82',
    dash: '2 5',
    icon: 'muscle',
    physiological: true,
  },
  fetal: {
    id: 'fetal',
    name: 'Fetal Movement',
    short: 'Fetal',
    color: '#c4a35a',
    dash: '10 4 2 4',
    icon: 'fetal',
    physiological: true,
  },
  electrode: {
    id: 'electrode',
    name: 'Electrode Signal',
    short: 'Electrode',
    color: '#3a3532',
    dash: '1 3',
    icon: 'electrode',
    physiological: false,
  },
}

export const CHARCOAL = '#3a3532'

/** Clinical Laying-like mix — starting point */
export const CLINICAL_WEIGHTS: Weights = {
  heartbeat: 0.45,
  breathing: 0.1,
  muscle: 0.3,
  fetal: 0.09,
  electrode: 0.06,
}

/** Seating seated target mix */
export const TARGET_WEIGHTS: Weights = {
  heartbeat: 0.21,
  breathing: 0.36,
  muscle: 0.12,
  fetal: 0.18,
  electrode: 0.13,
}

/**
 * Where the calibration actually lands — a few points off the seated target on
 * every mechanism. A fit that sat exactly on the target would be a red flag
 * rather than a result, so the residual is left visible.
 */
export const FITTED_WEIGHTS: Weights = {
  heartbeat: 0.23,
  breathing: 0.34,
  muscle: 0.13,
  fetal: 0.17,
  electrode: 0.13,
}

export const FEATURE_LABELS = [
  'F0',
  'F1',
  'P0.3',
  'P0.8',
  'P1.4',
  'P2.2',
  'Ent',
  'RMS',
] as const
