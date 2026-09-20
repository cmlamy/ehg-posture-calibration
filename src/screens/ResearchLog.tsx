import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ACTIONS,
  ACTION_IDS,
  DATASET_LABELS,
  LOG_ENTRIES,
  dayKey,
  formatDay,
  formatTime,
  toCsv,
  toJson,
  type ActionId,
  type LogDatasetId,
  type LogEntry,
} from '../lib/researchLog'
import { springSoft } from '../lib/motion'

const DATASET_FILTERS: { id: LogDatasetId | 'all'; label: string }[] = [
  { id: 'all', label: 'All datasets' },
  { id: 'seating', label: 'Seating' },
  { id: 'laying', label: 'Laying' },
]

// ─── Filter pills ────────────────────────────────────────────────────────────

function FilterPill({
  active,
  label,
  glyph,
  count,
  layoutGroup,
  onClick,
}: {
  active: boolean
  label: string
  glyph?: string
  count?: number
  layoutGroup: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="relative rounded-full px-3.5 py-1.5 text-sm transition-colors"
      style={{ color: active ? '#2c2826' : '#8a7f7a', fontWeight: active ? 600 : 400 }}
    >
      {active && (
        <motion.span
          layoutId={layoutGroup}
          className="absolute inset-0 rounded-full"
          style={{ background: '#ead5d0' }}
          transition={springSoft}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
        {glyph && <span aria-hidden>{glyph}</span>}
        {label}
        {count !== undefined && (
          <span className="font-mono text-xs text-charcoal/40">{count}</span>
        )}
      </span>
    </button>
  )
}

// ─── One timeline entry ──────────────────────────────────────────────────────

function TimelineEntry({
  entry,
  isOpen,
  onToggle,
  index,
}: {
  entry: LogEntry
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  const action = ACTIONS[entry.action]

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: Math.min(index, 8) * 0.04 }}
      className="relative pl-14"
    >
      {/* Node on the rail */}
      <motion.span
        aria-hidden
        animate={{ scale: isOpen ? 1.03 : 1 }}
        transition={springSoft}
        className="absolute left-[18px] top-4 flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-cream"
        style={{ background: action.color }}
      >
        {action.glyph}
      </motion.span>

      <motion.div
        layout
        className="overflow-hidden rounded-2xl bg-cream ring-1 ring-blush/60"
        animate={{
          boxShadow: isOpen
            ? '0 10px 28px rgba(58,53,50,0.08)'
            : '0 0 0 rgba(58,53,50,0)',
        }}
        transition={springSoft}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-4 px-5 py-4 text-left"
        >
          <span className="font-mono text-sm text-charcoal/50 tabular-nums">
            {formatTime(entry.at)}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider text-cream uppercase"
                style={{ background: action.color }}
              >
                {action.label}
              </span>
              <span className="rounded-full bg-ivory px-2 py-0.5 text-[10px] font-medium tracking-wider text-charcoal/55 uppercase ring-1 ring-blush/70">
                {DATASET_LABELS[entry.dataset]}
              </span>
            </span>
            <span className="mt-1.5 block truncate text-[15px] text-ink">{entry.summary}</span>
          </span>

          {entry.metric && (
            <span className="hidden text-right sm:block">
              <span className="block text-[10px] tracking-[0.14em] text-charcoal/40 uppercase">
                {entry.metric.label}
              </span>
              <span className="font-display text-lg text-ink">{entry.metric.value}</span>
            </span>
          )}

          <motion.span
            aria-hidden
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={springSoft}
            className="text-charcoal/40"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 2.5L9.5 7L5 11.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 95, damping: 27 }}
              className="overflow-hidden"
            >
              <div className="border-t border-blush-deep/30 px-5 pt-4 pb-5">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
                  Parameters
                </p>
                <dl className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                  {Object.entries(entry.parameters).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[minmax(6rem,9rem)_1fr] gap-3 text-sm"
                    >
                      <dt className="truncate text-charcoal/55">{key}</dt>
                      <dd className="font-mono text-charcoal/80">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-5 text-[10px] font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
                  Result
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{entry.result}</p>

                {entry.note && (
                  <p className="mt-3 border-l-2 border-blush-deep/50 pl-3 text-sm leading-relaxed text-charcoal/60 italic">
                    {entry.note}
                  </p>
                )}

                <p className="mt-4 font-mono text-[11px] text-charcoal/35">
                  {new Date(entry.at).toISOString()} · {entry.id}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  )
}

// ─── Research Log page ───────────────────────────────────────────────────────

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ResearchLog() {
  const [dataset, setDataset] = useState<LogDatasetId | 'all'>('all')
  const [action, setAction] = useState<ActionId | 'all'>('all')
  const [openIds, setOpenIds] = useState<string[]>([])

  const filtered = useMemo(
    () =>
      LOG_ENTRIES.filter((entry) => {
        // 'both' entries belong to either dataset view
        const datasetMatch =
          dataset === 'all' || entry.dataset === dataset || entry.dataset === 'both'
        const actionMatch = action === 'all' || entry.action === action
        return datasetMatch && actionMatch
      }),
    [dataset, action],
  )

  const actionCounts = useMemo(() => {
    const counts = {} as Record<ActionId, number>
    for (const id of ACTION_IDS) counts[id] = 0
    for (const entry of LOG_ENTRIES) counts[entry.action]++
    return counts
  }, [])

  const days = useMemo(() => {
    const groups: { key: string; label: string; entries: LogEntry[] }[] = []
    for (const entry of filtered) {
      const key = dayKey(entry.at)
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.entries.push(entry)
      else groups.push({ key, label: formatDay(entry.at), entries: [entry] })
    }
    return groups
  }, [filtered])

  const toggle = (id: string) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const allOpen = filtered.length > 0 && filtered.every((e) => openIds.includes(e.id))
  // Local date, not UTC — the filename should match the researcher's day.
  const stamp = new Date().toLocaleDateString('en-CA')

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Lab notebook
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
            Research log
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            Every action taken on the two datasets, in order, with the parameters and the
            result.
          </p>
        </motion.header>

        {/* Filters + export */}
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.06 }}
          className="space-y-3 rounded-3xl bg-cream px-5 py-4 ring-1 ring-blush/60"
        >
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-[10px] font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
              Dataset
            </span>
            {DATASET_FILTERS.map((f) => (
              <FilterPill
                key={f.id}
                active={dataset === f.id}
                label={f.label}
                layoutGroup="dataset-filter"
                onClick={() => setDataset(f.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-[10px] font-semibold tracking-[0.16em] text-charcoal/40 uppercase">
              Action
            </span>
            <FilterPill
              active={action === 'all'}
              label="All actions"
              layoutGroup="action-filter"
              onClick={() => setAction('all')}
            />
            {ACTION_IDS.map((id) => (
              <FilterPill
                key={id}
                active={action === id}
                label={ACTIONS[id].label}
                glyph={ACTIONS[id].glyph}
                count={actionCounts[id]}
                layoutGroup="action-filter"
                onClick={() => setAction(id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-blush-deep/30 pt-3">
            <span className="text-sm text-charcoal/55">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of{' '}
              {LOG_ENTRIES.length} entries
            </span>

            <button
              type="button"
              onClick={() =>
                setOpenIds(allOpen ? [] : filtered.map((e) => e.id))
              }
              disabled={filtered.length === 0}
              className="ml-auto rounded-full bg-ivory px-3.5 py-1.5 text-sm font-medium text-charcoal/70 ring-1 ring-blush/70 transition-colors hover:text-ink disabled:opacity-40"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
            <button
              type="button"
              onClick={() =>
                download(`research-log-${stamp}.csv`, toCsv(filtered), 'text/csv')
              }
              disabled={filtered.length === 0}
              className="rounded-full bg-ivory px-3.5 py-1.5 text-sm font-medium text-charcoal/70 ring-1 ring-blush/70 transition-colors hover:text-ink disabled:opacity-40"
            >
              ⤓ Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(`research-log-${stamp}.json`, toJson(filtered), 'application/json')
              }
              disabled={filtered.length === 0}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-cream transition-opacity disabled:opacity-40"
              style={{ background: '#3a3532' }}
            >
              ⤓ Export JSON
            </button>
          </div>
        </motion.div>

        {/* Timeline */}
        {days.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springSoft}
            className="rounded-3xl bg-cream px-6 py-12 text-center text-charcoal/50 ring-1 ring-blush/60"
          >
            No entries match this filter.
          </motion.p>
        ) : (
          <div className="relative">
            {/* Vertical rail */}
            <div
              className="absolute top-2 bottom-2 left-[30px] w-px bg-blush-deep/50"
              aria-hidden
            />

            <div className="space-y-8">
              {days.map((day) => (
                <motion.section key={day.key} layout>
                  <motion.h2
                    layout
                    className="relative mb-3 pl-14 text-xs font-semibold tracking-[0.18em] text-charcoal/45 uppercase"
                  >
                    <span
                      className="absolute left-[25px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-blush-deep"
                      aria-hidden
                    />
                    {day.label}
                  </motion.h2>

                  <ul className="space-y-2.5">
                    {day.entries.map((entry, i) => (
                      <TimelineEntry
                        key={entry.id}
                        entry={entry}
                        index={i}
                        isOpen={openIds.includes(entry.id)}
                        onToggle={() => toggle(entry.id)}
                      />
                    ))}
                  </ul>
                </motion.section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
