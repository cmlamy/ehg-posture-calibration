/**
 * The five mechanism hues — terracotta, sage, plum, mustard, charcoal — are
 * reserved for the mechanisms defined in `lib/mechanisms.ts`. A hue should
 * never mean two different things, so anything that is not a mechanism takes
 * its colour from here instead.
 */
export const UI = {
  /** Headings and primary text */
  ink: '#2c2826',
  /** Raw, uncalibrated EHG traces — the electrode signal itself */
  charcoal: '#3a3532',
  /** Real-world seated material: the Seating dataset, calibrated output, passes */
  sageDeep: '#5f6b58',
  /** The clinical Laying dataset, and secondary structural accents */
  stone: '#8a7f7a',
  /** Tertiary structural accent */
  stoneSoft: '#a09690',
  /** Dividers and rails, and the sitting target a calibration is fitted to */
  blushDeep: '#d9b8b2',
} as const
