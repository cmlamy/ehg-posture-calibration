import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { MECHANISMS, type MechanismId } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { MechanismIcon } from './MechanismIcon'
import { SpringNumber } from './SpringNumber'
import { Waveform } from './Waveform'

type MechanismSliderProps = {
  id: MechanismId
  value: number
  samples: number[]
  emphasized: boolean
  onChange: (id: MechanismId, next: number) => void
  onHover: (id: MechanismId | null) => void
}

export function MechanismSlider({
  id,
  value,
  samples,
  emphasized,
  onChange,
  onHover,
}: MechanismSliderProps) {
  const meta = MECHANISMS[id]
  const pct = Math.round(value * 100)

  return (
    <motion.div
      layout
      animate={{
        scale: emphasized ? 1.02 : 1,
        y: emphasized ? -2 : 0,
      }}
      transition={springSoft}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className="rounded-3xl bg-cream/80 p-5 ring-1 ring-blush/80"
      style={{
        boxShadow: emphasized
          ? `0 10px 28px color-mix(in srgb, ${meta.color} 22%, transparent)`
          : '0 4px 16px color-mix(in srgb, #3a3532 6%, transparent)',
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory"
          aria-hidden="true"
        >
          <MechanismIcon id={id} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight text-ink">
            {id === 'heartbeat' ? '♡ ' : ''}
            {meta.name}
          </p>
          <p className="text-sm text-charcoal/70">
            <SpringNumber value={pct} suffix="%" />
            <span className="ml-2 font-mono text-xs tracking-wide">
              {meta.dash ? 'pattern' : 'solid'}
            </span>
          </p>
        </div>
      </div>

      <div className="mb-4 h-12">
        <Waveform
          samples={samples}
          color={meta.color}
          dash={meta.dash}
          height={48}
          strokeWidth={2}
        />
      </div>

      <label className="sr-only" htmlFor={`slider-${id}`}>
        {meta.name} contribution
      </label>
      <input
        id={`slider-${id}`}
        className="mech-slider"
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onInput={(event) => {
          onChange(id, Number(event.currentTarget.value) / 100)
        }}
        onChange={(event) => {
          onChange(id, Number(event.currentTarget.value) / 100)
        }}
        style={{ '--thumb': meta.color, '--track': meta.color } as CSSProperties}
      />
    </motion.div>
  )
}
