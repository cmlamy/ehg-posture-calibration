/**
 * Springs are heavily overdamped — a ratio well above 1 — so they crawl into
 * place and never cross their target. At a ratio of 1 motion settles as fast as
 * it can without bouncing; above that it slows down and glides. Below 1 the
 * value overshoots and swings back, which is what reads as bounce.
 * ratio = damping / (2 * sqrt(stiffness)), using Framer Motion's default mass
 * of 1. Stiffness is low as well, so nothing snaps.
 */
const spring = (stiffness: number, ratio = 1.4) => ({
  type: 'spring' as const,
  stiffness,
  damping: Math.round(ratio * 2 * Math.sqrt(stiffness)),
})

export const springSoft = spring(50)
export const springSnappy = spring(70)

/** useSpring takes the raw config without a `type` field. */
export const springNumber = { stiffness: 50, damping: 20 }

/** Growth of the projection uncertainty band out of the median. */
export const springSpread = { stiffness: 32, damping: 16 }

/** Laying recording morphing into the fitted sitting model. */
export const springFit = { stiffness: 18, damping: 16 }
