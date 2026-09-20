import { useState } from 'react'
import { motion } from 'framer-motion'
import { MechanismIcon } from '../components/MechanismIcon'
import { LAYING_STATS, SEATING_STATS } from '../lib/datasets'
import { MECHANISMS, MECHANISM_IDS } from '../lib/mechanisms'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-[15px] text-ink">
          {label}
        </label>
        <p className="mt-0.5 text-sm leading-relaxed text-charcoal/55">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="relative mt-1 h-6 w-11 flex-shrink-0 rounded-full"
        style={{ background: value ? UI.sageDeep : '#d9b8b2' }}
      >
        <motion.span
          layout
          transition={springSoft}
          className="absolute top-0.5 h-5 w-5 rounded-full bg-cream"
          style={{ left: value ? 22 : 2 }}
        />
        <span className="sr-only">{value ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

// ─── Settings page ───────────────────────────────────────────────────────────

export function Settings() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [idleDrift, setIdleDrift] = useState(true)
  const [showPatterns, setShowPatterns] = useState(true)
  const [autoExpand, setAutoExpand] = useState(false)

  const datasets = [
    { stats: SEATING_STATS, role: 'Tuning + validation baseline' },
    { stats: LAYING_STATS, role: 'Calibration target distribution' },
  ]

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            VERA
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Settings
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            Display preferences and the fixed reference values this study runs on.
          </p>
        </motion.header>

        {/* Display preferences */}
        <motion.section
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.06 }}
          className="rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <h2 className="text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
            Display
          </h2>
          <div className="mt-2 divide-y divide-blush-deep/30">
            <Toggle
              id="setting-idle-drift"
              label="Idle waveform drift"
              description="Keep calibrated waveforms slowly breathing when nothing is being dragged."
              value={idleDrift}
              onChange={setIdleDrift}
            />
            <Toggle
              id="setting-reduced-motion"
              label="Reduced motion"
              description="Shorten entrance animations and damp spring overshoot."
              value={reducedMotion}
              onChange={setReducedMotion}
            />
            <Toggle
              id="setting-patterns"
              label="Pattern fills on charts"
              description="Pair every colour-coded segment with a hatch or texture, never colour alone."
              value={showPatterns}
              onChange={setShowPatterns}
            />
            <Toggle
              id="setting-auto-expand"
              label="Auto-expand log entries"
              description="Open research log entries with their parameters already visible."
              value={autoExpand}
              onChange={setAutoExpand}
            />
          </div>
        </motion.section>

        {/* Mechanism colour identities */}
        <motion.section
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.12 }}
          className="rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <h2 className="text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
            Mechanism identities
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/60">
            Fixed across every screen. Each mechanism keeps its colour, icon, and line
            style so a hue never means two things.
          </p>
          <ul className="mt-4 space-y-2">
            {MECHANISM_IDS.map((id) => {
              const m = MECHANISMS[id]
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-2xl bg-ivory px-4 py-3"
                >
                  <MechanismIcon id={id} className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-[15px] text-ink">{m.name}</span>
                  <svg width="44" height="10" viewBox="0 0 44 10" aria-hidden>
                    <line
                      x1="0"
                      y1="5"
                      x2="44"
                      y2="5"
                      stroke={m.color}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeDasharray={m.dash || undefined}
                    />
                  </svg>
                  <span className="w-20 text-right font-mono text-xs text-charcoal/45">
                    {m.color}
                  </span>
                </li>
              )
            })}
          </ul>
        </motion.section>

        {/* Data sources */}
        <motion.section
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.18 }}
          className="rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <h2 className="text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
            Data sources
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/60">
            Exactly two sources. No others are introduced at any stage of the pipeline.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {datasets.map(({ stats, role }) => (
              <div key={stats.name} className="rounded-2xl bg-ivory px-4 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: stats.color }}
                    aria-hidden
                  />
                  <p className="font-display text-xl text-ink">{stats.name}</p>
                </div>
                <p className="mt-1 text-sm text-charcoal/60">{stats.subtitle}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal/50">Role</dt>
                    <dd className="text-right text-charcoal/80">{role}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal/50">Participants</dt>
                    <dd className="font-mono text-charcoal/80">{stats.participants}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal/50">Clips</dt>
                    <dd className="font-mono text-charcoal/80">{stats.totalClips}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal/50">Bandpass</dt>
                    <dd className="font-mono text-charcoal/80">{stats.bandpass}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Processing constants */}
        <motion.section
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.24 }}
          className="rounded-3xl bg-cream px-6 py-5 ring-1 ring-blush/60"
        >
          <h2 className="text-xs font-semibold tracking-[0.18em] text-charcoal/40 uppercase">
            Processing constants
          </h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[
              ['Bandpass', '0.2–3 Hz'],
              ['Channels', 'Bipolar, 4-channel'],
              ['Clip length', '60 s'],
              ['Spectral features', '8'],
              ['Split', 'Participant-level'],
              ['Loudness ratio', '1.34×'],
            ].map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(6rem,9rem)_1fr] gap-3 text-sm"
              >
                <dt className="text-charcoal/55">{key}</dt>
                <dd className="font-mono text-charcoal/80">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-charcoal/50 italic">
            These are fixed for the study. Changing them would invalidate the calibration
            already recorded in the research log.
          </p>
        </motion.section>
      </div>
    </div>
  )
}
