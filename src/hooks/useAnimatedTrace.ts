import { useEffect, useMemo, useState } from 'react'
import { buildTrace, mixSample, PHASE_RATE } from '../lib/signal'
import { TARGET_WEIGHTS, CLINICAL_WEIGHTS } from '../lib/mechanisms'
import type { DatasetId } from '../lib/datasets'

/** Returns an always-animating waveform trace for dataset preview cards. */
export function useAnimatedTrace(variant: DatasetId, sampleCount = 80) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      setPhase((p) => p + ((now - last) / 1000) * PHASE_RATE)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return useMemo(() => {
    if (variant === 'seating') {
      // Seating = seated target mix (breathing-dominant, smooth)
      return buildTrace((t) => mixSample(TARGET_WEIGHTS, t), phase, 10)
    } else {
      // Laying = clinical mix with a contraction burst overlaid
      return Array.from({ length: sampleCount }, (_, i) => {
        const t = phase * 0.22 + (i / (sampleCount - 1)) * 10
        const contraction = Math.exp(-(((t % 7.2) - 2.1) ** 2) / 0.35) * 1.4
        return mixSample(CLINICAL_WEIGHTS, t) + contraction
      })
    }
  }, [variant, phase, sampleCount])
}
