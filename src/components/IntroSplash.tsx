import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { PostureIntro } from './PostureIntro'

type IntroSplashProps = {
  onEnter: () => void
}

const LOAD_MS = 7000

export function IntroSplash({ onEnter }: IntroSplashProps) {
  const raw = useMotionValue(0)
  const progress = useTransform(raw, [0, 1], [0, 1])
  const [p, setP] = useState(0)
  const entered = useRef(false)
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter

  useMotionValueEvent(progress, 'change', setP)

  const enter = () => {
    if (entered.current) return
    entered.current = true
    onEnterRef.current()
  }

  useEffect(() => {
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      if (entered.current) return
      const t = Math.min(1, (now - started) / LOAD_MS)
      const eased = t * t * (3 - 2 * t)
      raw.set(eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else enter()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [raw])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') enter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.div
      role="dialog"
      aria-label="VERA introduction"
      aria-modal="true"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ivory px-6 py-10"
    >
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.08 }}
        className="font-display text-5xl font-medium tracking-[0.28em] text-ink md:text-7xl"
      >
        VERA
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.7 }}
        className="mt-3 max-w-lg text-center text-xs font-medium tracking-[0.16em] text-sage-deep uppercase"
      >
        Vertical EHG Response Adaptation
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.2 }}
        className="mt-8 w-full"
      >
        <PostureIntro progress={p} />
      </motion.div>

      <p className="sr-only" aria-live="polite">
        Loading {Math.round(p * 100)} percent
      </p>

      <motion.button
        type="button"
        onClick={enter}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.7 }}
        className="mt-8 rounded-full px-7 py-2.5 text-sm font-medium tracking-wide text-cream"
        style={{ background: UI.charcoal }}
      >
        Let’s start
      </motion.button>
    </motion.div>
  )
}
