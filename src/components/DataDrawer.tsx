import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { springSoft } from '../lib/motion'
import { type DatasetId, SEATING_STATS, LAYING_STATS } from '../lib/datasets'
import { ParticipantSplit } from './ParticipantSplit'
import { Waveform } from './Waveform'
import { useAnimatedTrace } from '../hooks/useAnimatedTrace'

interface DataDrawerProps {
  open: boolean
  datasetId: DatasetId | null
  onClose: () => void
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-ivory px-4 py-3">
      <p className="text-xs font-medium tracking-[0.14em] text-charcoal/40 uppercase">{label}</p>
      <p className="mt-0.5 font-display text-xl font-medium text-ink">{value}</p>
    </div>
  )
}

function SeatingDrawerBody() {
  const trace = useAnimatedTrace('seating')
  const s = SEATING_STATS
  return (
    <div className="space-y-8">
      {/* Live waveform */}
      <div className="rounded-3xl bg-ivory p-4">
        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-charcoal/40 uppercase">
          Seated EHG — live preview
        </p>
        <div className="h-20">
          <Waveform samples={trace} color={s.color} strokeWidth={1.8} height={80} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Participants" value={s.participants} />
        <StatPill label="Total clips" value={s.totalClips} />
        <StatPill label="Clip length" value={s.clipDuration} />
        <StatPill label="Split method" value={s.splitLabel} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatPill label="Channels" value={s.channelConfig} />
        <StatPill label="Bandpass" value={s.bandpass} />
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-charcoal/70">{s.description}</p>

      {/* Participant split */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-blush/60">
        <p className="mb-5 text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
          Participant split
        </p>
        <ParticipantSplit />
      </div>
    </div>
  )
}

function LayingDrawerBody() {
  const trace = useAnimatedTrace('laying')
  const s = LAYING_STATS
  const contractionPct = Math.round((s.contractionClips / s.totalClips) * 100)
  const baselinePct = 100 - contractionPct

  return (
    <div className="space-y-8">
      {/* Live waveform with contraction burst */}
      <div className="rounded-3xl bg-ivory p-4">
        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-charcoal/40 uppercase">
          Clinical EHG — contraction-labelled preview
        </p>
        <div className="h-20">
          <Waveform samples={trace} color={s.color} strokeWidth={1.8} height={80} />
        </div>
        <p className="mt-2 text-xs text-charcoal/40">
          ↑ Periodic contraction bursts visible in clinical signal
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Participants" value={s.participants} />
        <StatPill label="Total clips" value={s.totalClips} />
        <StatPill label="Clip length" value={s.clipDuration} />
        <StatPill label="Channels" value={s.channelConfig} />
      </div>

      {/* Contraction / baseline breakdown */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-blush/60">
        <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
          Clip composition
        </p>
        {/* Stacked bar */}
        <div className="mb-4 flex h-5 overflow-hidden rounded-full">
          <motion.div
            className="h-full"
            initial={{ width: 0 }}
            animate={{ width: `${contractionPct}%` }}
            transition={{ ...springSoft, delay: 0.15 }}
            style={{ background: s.color }}
          />
          <motion.div
            className="h-full"
            initial={{ width: 0 }}
            animate={{ width: `${baselinePct}%` }}
            transition={{ ...springSoft, delay: 0.25 }}
            style={{ background: s.accentColor }}
          />
        </div>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-charcoal/70">Contraction</span>
            <span className="font-medium text-ink">{s.contractionClips} clips</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.accentColor }} />
            <span className="text-charcoal/70">Baseline</span>
            <span className="font-medium text-ink">{s.baselineClips} clips</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-charcoal/70">{s.description}</p>

      {/* Bandpass note */}
      <div className="flex items-start gap-3 rounded-2xl bg-ivory px-4 py-3">
        <span className="mt-0.5 text-base">⚙</span>
        <p className="text-xs leading-relaxed text-charcoal/60">
          <strong className="text-charcoal/80">Loudness correction</strong> applied to Laying before feature
          comparison — dataset-level amplitude ratio corrected against the Seating reference.
          This is an equipment correction, not a slider parameter.
        </p>
      </div>
    </div>
  )
}

export function DataDrawer({ open, datasetId, onClose }: DataDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const meta = datasetId === 'seating' ? SEATING_STATS : datasetId === 'laying' ? LAYING_STATS : null

  return (
    <AnimatePresence>
      {open && meta && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${meta.name} dataset details`}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-cream shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 110, damping: 29 }}
          >
            {/* Drawer header */}
            <div
              className="flex items-start justify-between border-b border-blush-deep/40 px-7 py-6"
              style={{ background: `color-mix(in srgb, ${meta.color} 8%, #faf6f0)` }}
            >
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-charcoal/40 uppercase">
                  Dataset
                </p>
                <h2
                  className="mt-1 font-display text-3xl font-medium tracking-tight text-ink"
                >
                  {meta.name}
                </h2>
                <p className="mt-1 text-sm text-charcoal/60">{meta.subtitle}</p>
              </div>

              <button
                onClick={onClose}
                className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-blush-deep/60 bg-cream text-charcoal/50 transition-colors hover:border-charcoal/30 hover:text-charcoal"
                aria-label="Close drawer"
                id="data-drawer-close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-7 py-7">
              {datasetId === 'seating' ? <SeatingDrawerBody /> : <LayingDrawerBody />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
