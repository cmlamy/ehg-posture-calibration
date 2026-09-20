import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ACTIONS,
  DATASET_LABELS,
  LOG_ENTRIES,
  dayKey,
  formatDay,
  loadDayNotes,
  saveDayNote,
  todayKey,
  toCsv,
  toJson,
  type LogEntry,
} from '../lib/researchLog'
import { springSoft } from '../lib/motion'

function headlineMetrics(entries: LogEntry[]) {
  const map = new Map<string, string>()
  for (const entry of entries) {
    if (entry.metric && !map.has(entry.metric.label)) {
      map.set(entry.metric.label, entry.metric.value)
    }
  }
  return [...map.entries()].map(([label, value]) => ({ label, value }))
}

function DayNotes({ day }: { day: string }) {
  const [text, setText] = useState(() => loadDayNotes()[day] ?? '')

  useEffect(() => {
    setText(loadDayNotes()[day] ?? '')
  }, [day])

  return (
    <aside className="flex flex-col border-t border-blush-deep/30 bg-ivory/70 p-5 lg:border-t-0 lg:border-l">
      <div className="lg:sticky lg:top-6">
      <label
        htmlFor={`day-note-${day}`}
        className="text-[10px] font-semibold tracking-[0.16em] text-charcoal/40 uppercase"
      >
        Your notes
      </label>
      <p className="mt-1 text-sm text-charcoal/50">
        Anything you want to keep with this day — numbers, questions, observations.
      </p>
      <textarea
        id={`day-note-${day}`}
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          saveDayNote(day, next)
        }}
        placeholder="Write your own data here."
        className="mt-3 min-h-[16rem] w-full resize-y rounded-2xl bg-cream px-3.5 py-3 text-sm leading-relaxed text-ink outline-none ring-1 ring-blush/50 placeholder:text-charcoal/35 lg:min-h-[22rem]"
      />
      </div>
    </aside>
  )
}

function DayReport({
  day,
  label,
  entries,
  index,
}: {
  day: string
  label: string
  entries: LogEntry[]
  index: number
}) {
  const metrics = headlineMetrics(entries)
  const chronological = [...entries].reverse()

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: Math.min(index, 4) * 0.05 }}
      className="overflow-hidden rounded-3xl bg-cream ring-1 ring-blush/60"
    >
      <header className="border-b border-blush-deep/30 px-6 py-5">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-sage-deep uppercase">
          Report card
        </p>
        <h2 className="mt-1 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
          {label}
        </h2>
        {metrics.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="text-[10px] tracking-[0.14em] text-charcoal/40 uppercase">
                  {metric.label}
                </dt>
                <dd className="font-display text-2xl text-ink">{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19.5rem]">
        <div className="space-y-0 divide-y divide-blush-deep/30 px-6">
          {chronological.length === 0 ? (
            <p className="py-8 text-sm text-charcoal/50">
              Nothing recorded this day yet. The note on the side is still yours.
            </p>
          ) : (
            chronological.map((entry) => {
              const action = ACTIONS[entry.action]
              return (
                <section key={entry.id} className="py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider text-cream uppercase"
                      style={{ background: action.color }}
                    >
                      {action.label}
                    </span>
                    <span className="rounded-full bg-ivory px-2 py-0.5 text-[10px] font-medium tracking-wider text-charcoal/55 uppercase ring-1 ring-blush/70">
                      {DATASET_LABELS[entry.dataset]}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-medium text-ink">
                    {entry.summary}
                  </h3>
                  <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                    {Object.entries(entry.parameters).map(([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[minmax(6.5rem,8.5rem)_1fr] gap-3 text-sm"
                      >
                        <dt className="text-charcoal/55">{key}</dt>
                        <dd className="font-mono text-charcoal/85">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-ink">{entry.result}</p>
                  {entry.note && (
                    <p className="mt-2 border-l-2 border-blush-deep/50 pl-3 text-sm leading-relaxed text-charcoal/60 italic">
                      {entry.note}
                    </p>
                  )}
                </section>
              )
            })
          )}
        </div>
        <DayNotes day={day} />
      </div>
    </motion.article>
  )
}

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
  const days = useMemo(() => {
    const groups: { key: string; label: string; entries: LogEntry[] }[] = []
    for (const entry of LOG_ENTRIES) {
      const key = dayKey(entry.at)
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.entries.push(entry)
      else groups.push({ key, label: formatDay(entry.at), entries: [entry] })
    }
    const today = todayKey()
    if (!groups.some((group) => group.key === today)) {
      groups.unshift({
        key: today,
        label: formatDay(`${today}T12:00:00`),
        entries: [],
      })
    }
    return groups
  }, [])

  const stamp = new Date().toLocaleDateString('en-CA')

  return (
    <div className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
              Lab notebook
            </p>
            <h1 className="mt-3 font-display text-5xl font-medium tracking-tight md:text-6xl">
              Research log
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
              One report card per day — every split, threshold, and result on the left,
              your own notes on the right.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                download(`research-log-${stamp}.csv`, toCsv(LOG_ENTRIES), 'text/csv')
              }
              className="rounded-full bg-cream px-3.5 py-1.5 text-sm font-medium text-charcoal/70 ring-1 ring-blush/70 transition-colors hover:text-ink"
            >
              ⤓ Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(`research-log-${stamp}.json`, toJson(LOG_ENTRIES), 'application/json')
              }
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-cream"
              style={{ background: '#3a3532' }}
            >
              ⤓ Export JSON
            </button>
          </div>
        </motion.header>

        <div className="space-y-10">
          {days.map((day, index) => (
            <DayReport
              key={day.key}
              day={day.key}
              label={day.label}
              entries={day.entries}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
