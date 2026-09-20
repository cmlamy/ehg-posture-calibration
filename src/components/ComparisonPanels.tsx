import { motion } from 'framer-motion'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { Waveform } from './Waveform'

type ComparisonPanelsProps = {
  clinical: number[]
  calibrated: number[]
  target: number[]
}

const panels = [
  { key: 'clinical', label: 'Laying (clinical)', caption: 'Started here', color: UI.charcoal, dash: '5 4' },
  { key: 'calibrated', label: 'Calibrated', caption: 'Made this', color: UI.sageDeep, dash: '' },
  { key: 'target', label: 'Seating target', caption: 'Aiming for this', color: UI.stone, dash: '8 5' },
] as const

export function ComparisonPanels({ clinical, calibrated, target }: ComparisonPanelsProps) {
  const traces = { clinical, calibrated, target }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {panels.map((panel, i) => (
        <motion.article
          key={panel.key}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.28 + i * 0.06 }}
          className="rounded-3xl bg-cream/80 p-5 ring-1 ring-blush/80"
        >
          <p className="text-xs font-medium tracking-[0.16em] text-sage-deep uppercase">
            {panel.label}
          </p>
          <p className="mt-1 text-sm text-charcoal/70">{panel.caption}</p>
          <div className="mt-3 h-16">
            <Waveform
              samples={traces[panel.key]}
              color={panel.color}
              dash={panel.dash}
              height={64}
              strokeWidth={1.8}
            />
          </div>
        </motion.article>
      ))}
    </div>
  )
}
