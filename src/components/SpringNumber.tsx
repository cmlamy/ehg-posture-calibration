import { useEffect, useState } from 'react'
import { useMotionValueEvent, useSpring } from 'framer-motion'
import { springNumber } from '../lib/motion'

type SpringNumberProps = {
  value: number
  decimals?: number
  suffix?: string
}

export function SpringNumber({ value, decimals = 0, suffix = '' }: SpringNumberProps) {
  const spring = useSpring(value, springNumber)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  useMotionValueEvent(spring, 'change', (latest) => {
    setShown(latest)
  })

  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  )
}
