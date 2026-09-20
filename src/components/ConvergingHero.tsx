import { motion } from 'framer-motion'
import { MECHANISMS, MECHANISM_IDS, type MechanismId } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { Waveform } from './Waveform'

type ConvergingHeroProps = {
  mini: Record<MechanismId, number[]>
  combined: number[]
  hovered: MechanismId | null
}

export function ConvergingHero({ mini, combined, hovered }: ConvergingHeroProps) {
  return (
    <section className="rounded-[2rem] bg-cream p-6 shadow-[0_20px_50px_rgba(58,53,50,0.06)] ring-1 ring-blush md:p-8">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${MECHANISM_IDS.length}, minmax(0, 1fr))`,
        }}
      >
        {MECHANISM_IDS.map((id) => {
          const meta = MECHANISMS[id]
          const dim = hovered && hovered !== id
          return (
            <motion.div
              key={id}
              animate={{ opacity: dim ? 0.35 : 1 }}
              transition={springSoft}
              className="h-14"
            >
              <Waveform
                samples={mini[id]}
                color={meta.color}
                dash={meta.dash}
                height={56}
                strokeWidth={1.8}
              />
            </motion.div>
          )
        })}
      </div>

      <svg viewBox="0 0 1000 90" className="mt-1 h-[70px] w-full" aria-hidden="true">
        {MECHANISM_IDS.map((id, i) => {
          const x = (1000 / MECHANISM_IDS.length) * (i + 0.5)
          const meta = MECHANISMS[id]
          return (
            <motion.path
              key={id}
              d={`M ${x} 8 C ${x} 50, 500 40, 500 88`}
              fill="none"
              stroke={meta.color}
              strokeWidth={hovered && hovered !== id ? 1 : 1.8}
              strokeDasharray={meta.dash || undefined}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: hovered && hovered !== id ? 0.25 : 0.85 }}
              transition={{ ...springSoft, delay: 0.12 + i * 0.05 }}
            />
          )
        })}
      </svg>

      <div className="h-44 md:h-56">
        <Waveform
          samples={combined}
          color="#2c2826"
          height={180}
          strokeWidth={2.6}
        />
      </div>
    </section>
  )
}
