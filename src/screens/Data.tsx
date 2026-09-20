import { useState } from 'react'
import { motion } from 'framer-motion'
import { DataDrawer } from '../components/DataDrawer'
import { Waveform } from '../components/Waveform'
import { useAnimatedTrace } from '../hooks/useAnimatedTrace'
import { type DatasetId, LAYING_STATS, SEATING_STATS } from '../lib/datasets'
import { springSoft } from '../lib/motion'

// ── Individual dataset card ─────────────────────────────────────────────────

interface DatasetCardProps {
  id: DatasetId
  name: string
  subtitle: string
  color: string
  accentColor: string
  participantCount: number
  clipCount: number
  tag: string
  onOpen: () => void
  index: number
}

function DatasetCard({
  id,
  name,
  subtitle,
  color,
  accentColor,
  participantCount,
  clipCount,
  tag,
  onOpen,
  index,
}: DatasetCardProps) {
  const trace = useAnimatedTrace(id)
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      id={`dataset-card-${id}`}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: 0.1 + index * 0.1 }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative w-full cursor-pointer overflow-hidden rounded-3xl bg-cream p-0 text-left ring-1 ring-blush/70 transition-shadow"
      style={{
        boxShadow: hovered
          ? `0 16px 40px color-mix(in srgb, ${color} 18%, transparent)`
          : '0 4px 18px color-mix(in srgb, #3a3532 6%, transparent)',
      }}
      aria-label={`Open ${name} dataset details`}
    >
      {/* Color accent bar */}
      <motion.div
        className="absolute left-0 top-0 h-1 w-full"
        animate={{ opacity: hovered ? 1 : 0.6 }}
        style={{ background: `linear-gradient(90deg, ${color}, ${accentColor})` }}
      />

      {/* Waveform background — faint */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-10"
        aria-hidden
      >
        <Waveform samples={trace} color={color} strokeWidth={3} height={112} />
      </div>

      {/* Card body */}
      <div className="relative z-10 px-7 pb-7 pt-8">
        {/* Tag pill */}
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-cream"
          style={{ background: color }}
        >
          {tag}
        </span>

        {/* Title */}
        <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink">
          {name}
        </h2>
        <p className="mt-1 text-sm text-charcoal/60">{subtitle}</p>

        {/* Stats */}
        <div className="mt-5 flex gap-6">
          <div>
            <p className="font-display text-2xl font-medium text-ink">{participantCount}</p>
            <p className="text-xs text-charcoal/50 tracking-wide uppercase">Participants</p>
          </div>
          <div className="w-px bg-blush-deep/40" />
          <div>
            <p className="font-display text-2xl font-medium text-ink">{clipCount}</p>
            <p className="text-xs text-charcoal/50 tracking-wide uppercase">Clips</p>
          </div>
        </div>

        {/* Live waveform */}
        <div className="mt-6 h-14 rounded-2xl bg-ivory px-3 py-2">
          <Waveform samples={trace} color={color} strokeWidth={1.8} height={48} />
        </div>

        {/* CTA row */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-charcoal/40">Click to explore</p>
          <motion.div
            animate={{ x: hovered ? 3 : 0 }}
            transition={springSoft}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blush-deep/60"
            style={{ color }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7H12M8 3L12 7L8 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.button>
  )
}

// ── Data page ───────────────────────────────────────────────────────────────

export function Data() {
  const [openDataset, setOpenDataset] = useState<DatasetId | null>(null)

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-5xl space-y-10">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Data sources
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Two datasets
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            All calibration work draws from exactly these two EHG sources. Click a card to explore.
          </p>
        </motion.header>

        {/* Dataset cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          <DatasetCard
            index={0}
            id="seating"
            name={SEATING_STATS.name}
            subtitle={SEATING_STATS.subtitle}
            color={SEATING_STATS.color}
            accentColor={SEATING_STATS.accentColor}
            participantCount={SEATING_STATS.participants}
            clipCount={SEATING_STATS.totalClips}
            tag="Real-world seated"
            onOpen={() => setOpenDataset('seating')}
          />
          <DatasetCard
            index={1}
            id="laying"
            name={LAYING_STATS.name}
            subtitle={LAYING_STATS.subtitle}
            color={LAYING_STATS.color}
            accentColor={LAYING_STATS.accentColor}
            participantCount={LAYING_STATS.participants}
            clipCount={LAYING_STATS.totalClips}
            tag="Clinical labelled"
            onOpen={() => setOpenDataset('laying')}
          />
        </div>

        {/* Relationship note */}
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.3 }}
          className="flex items-start gap-4 rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ivory text-charcoal/40">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 6v4M7 4.5V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">How these datasets relate</p>
            <p className="mt-1 text-sm leading-relaxed text-charcoal/60">
              Laying provides the <strong className="text-charcoal/80">target distribution</strong> — the clinical signal shape we're aiming to match.
              Seating provides the <strong className="text-charcoal/80">seated real-world baseline</strong> — the starting signal we calibrate.
              Mechanism weights are fitted so the calibrated Seating signal's 8-feature vector approaches the Laying distribution.
            </p>
          </div>
        </motion.div>

      </div>

      {/* Drawer — portal-level, sits outside the content container */}
      <DataDrawer
        open={openDataset !== null}
        datasetId={openDataset}
        onClose={() => setOpenDataset(null)}
      />
    </div>
  )
}
