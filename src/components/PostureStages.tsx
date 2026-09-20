import { motion } from 'framer-motion'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import type { PosturePhase } from '../lib/projection'

type PostureStagesProps = {
  posture: PosturePhase
  onChange: (next: PosturePhase) => void
}

function StageButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="relative rounded-full px-5 py-2 text-sm font-medium transition-colors"
      style={{ color: active ? '#faf6f0' : UI.charcoal }}
    >
      {active && (
        <motion.span
          layoutId="posture-stage-pill"
          className="absolute inset-0 rounded-full"
          style={{ background: UI.sageDeep }}
          transition={springSoft}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  )
}

export function PostureStages({ posture, onChange }: PostureStagesProps) {
  const isResting = posture === 'laying'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-full bg-cream p-1 ring-1 ring-blush/60">
        <StageButton
          label="Sitting"
          active={posture === 'sitting'}
          onClick={() => onChange('sitting')}
        />
        <StageButton
          label="Standing"
          active={posture === 'standing'}
          onClick={() => onChange('standing')}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange('laying')}
        disabled={isResting}
        aria-pressed={isResting}
        className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-charcoal/70 ring-1 ring-blush/60 transition-colors enabled:hover:bg-blush/30 enabled:hover:text-ink disabled:opacity-40"
      >
        ↺ Resting baseline
      </button>
    </div>
  )
}
