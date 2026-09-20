import { motion } from 'framer-motion'
import { useState } from 'react'
import { HALF_A, HALF_B, type Participant } from '../lib/datasets'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'

// Halves are participant groups, not mechanisms — structural neutrals only.
const HALF_A_COLOR = UI.sageDeep
const HALF_B_COLOR = UI.stone

// SVG person silhouette path (simple, friendly, gender-neutral)
function PersonIcon({
  filled,
  color,
  size = 28,
  participant,
  onHover,
  hovered,
}: {
  filled: boolean
  color: string
  size?: number
  participant: Participant
  onHover: (id: string | null) => void
  hovered: boolean
}) {
  return (
    <motion.div
      onMouseEnter={() => onHover(participant.id)}
      onMouseLeave={() => onHover(null)}
      animate={{
        scale: hovered ? 1.18 : 1,
        y: hovered ? -2 : 0,
      }}
      transition={springSoft}
      className="relative cursor-default"
      aria-label={`${participant.id} — Half ${participant.half}, ${participant.clips} clips`}
      role="img"
    >
      <svg
        width={size}
        height={size * 1.45}
        viewBox="0 0 24 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head */}
        <circle
          cx="12"
          cy="7"
          r="5"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 0 : 1.8}
          opacity={filled ? 1 : 0.45}
        />
        {/* Body */}
        <path
          d="M4 34 C4 22 20 22 20 34"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 0 : 1.8}
          opacity={filled ? 1 : 0.45}
          strokeLinecap="round"
        />
      </svg>

      {/* Clip count badge on hover */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0, y: 2, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-cream shadow-sm"
          style={{ background: color, fontSize: 10 }}
        >
          {participant.id} · {participant.clips} clips
        </motion.div>
      )}
    </motion.div>
  )
}

export function ParticipantSplit() {
  const [hovered, setHovered] = useState<string | null>(null)

  const halfAClips = HALF_A.reduce((s, p) => s + p.clips, 0)
  const halfBClips = HALF_B.reduce((s, p) => s + p.clips, 0)

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: HALF_A_COLOR }}
            aria-hidden
          />
          <span className="font-medium text-ink">Half A — Tuning</span>
          <span className="text-charcoal/50">{HALF_A.length} participants · {halfAClips} clips</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full border-2"
            style={{ borderColor: HALF_B_COLOR }}
            aria-hidden
          />
          <span className="font-medium text-ink">Half B — Testing</span>
          <span className="text-charcoal/50">{HALF_B.length} participants · {halfBClips} clips</span>
        </div>
      </div>

      {/* Caption */}
      <p className="text-xs text-charcoal/50 leading-relaxed max-w-lg">
        Each silhouette = one participant. The split is <strong className="text-charcoal/70">participant-level</strong>, not clip-level —
        no participant's clips appear in both halves. Half A trains the mechanism weights; Half B is held out for validation.
      </p>

      {/* Grid: Half A */}
      <div>
        <p
          className="mb-2 text-xs font-semibold tracking-[0.16em] uppercase"
          style={{ color: HALF_A_COLOR }}
        >
          Half A — Tuning ({HALF_A.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HALF_A.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.02 + i * 0.018 }}
            >
              <PersonIcon
                participant={p}
                filled={true}
                color={HALF_A_COLOR}
                size={22}
                onHover={setHovered}
                hovered={hovered === p.id}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-blush-deep/40" />
        <span className="text-xs text-charcoal/30 tracking-wide">participant split boundary</span>
        <div className="h-px flex-1 bg-blush-deep/40" />
      </div>

      {/* Grid: Half B */}
      <div>
        <p
          className="mb-2 text-xs font-semibold tracking-[0.16em] uppercase"
          style={{ color: HALF_B_COLOR }}
        >
          Half B — Testing ({HALF_B.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HALF_B.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.46 + i * 0.018 }}
            >
              <PersonIcon
                participant={p}
                filled={false}
                color={HALF_B_COLOR}
                size={22}
                onHover={setHovered}
                hovered={hovered === p.id}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
