import { motion } from 'framer-motion'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'

const STAGES = [
  { id: 'data', label: 'Data', icon: '⬡' },
  { id: 'signal', label: 'Signal', icon: '⌇' },
  { id: 'calibration', label: 'Calibration', icon: '◎' },
  { id: 'validation', label: 'Validation', icon: '✓' },
  { id: 'projection', label: 'Projection', icon: '→' },
] as const

type StageId = (typeof STAGES)[number]['id']

interface PipelineProgressProps {
  current?: StageId
}

export function PipelineProgress({ current = 'calibration' }: PipelineProgressProps) {
  const currentIdx = STAGES.findIndex((s) => s.id === current)

  return (
    <div className="relative flex items-center gap-0">
      {/* Connecting track */}
      <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-charcoal/10" aria-hidden />

      {STAGES.map((stage, i) => {
        const isDone = i < currentIdx
        const isActive = i === currentIdx

        return (
          <div key={stage.id} className="relative flex flex-1 flex-col items-center gap-2">
            {/* Node */}
            <motion.div
              initial={false}
              animate={{
                scale: isActive ? 1.05 : 1,
                backgroundColor: isDone
                  ? '#5f6b58'
                  : isActive
                    ? '#3a3532'
                    : 'transparent',
                borderColor: isDone
                  ? '#5f6b58'
                  : isActive
                    ? '#3a3532'
                    : '#d9b8b2',
              }}
              transition={springSoft}
              className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm"
              style={{
                color: isDone || isActive ? '#faf6f0' : UI.stone,
              }}
            >
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 7L5.5 10L11.5 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span className="font-mono text-xs leading-none">{i + 1}</span>
              )}

              {/* Active glow ring */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: [0.14, 0.06, 0.14], scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                  style={{ background: '#3a3532', borderRadius: '999px' }}
                />
              )}
            </motion.div>

            {/* Label */}
            <motion.span
              animate={{
                color: isActive ? '#2c2826' : isDone ? '#5f6b58' : '#a09690',
                fontWeight: isActive ? 600 : 400,
              }}
              transition={{ duration: 0.3 }}
              className="text-xs tracking-wide"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {stage.label}
            </motion.span>

            {/* Connector line segment (between nodes, not on last) */}
            {i < STAGES.length - 1 && (
              <div className="absolute left-1/2 top-[18px] h-px w-full bg-transparent" aria-hidden />
            )}
          </div>
        )
      })}
    </div>
  )
}
