import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { FOCUS_OPTIONS, GROUPS, type GroupFocus, type ResearchGroup } from '../lib/community'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'

type SentNote = {
  id: number
  groupId: string
  groupName: string
  body: string
  at: string
}

const PILL =
  'rounded-full px-3 py-1.5 text-sm ring-1 ring-blush/60 transition-colors'

export function Community() {
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<GroupFocus | 'all'>('all')
  const [compose, setCompose] = useState<ResearchGroup | null>(null)
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState<SentNote[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GROUPS.filter((g) => {
      const matchesFocus = focus === 'all' || g.focus.includes(focus)
      const blob = `${g.name} ${g.institution} ${g.city} ${g.country} ${g.contact} ${g.summary}`.toLowerCase()
      return matchesFocus && (!q || blob.includes(q))
    })
  }, [query, focus])

  const send = () => {
    if (!compose || !draft.trim()) return
    const note: SentNote = {
      id: Date.now(),
      groupId: compose.id,
      groupName: compose.name,
      body: draft.trim(),
      at: new Date().toLocaleString(),
    }
    setSent((prev) => [note, ...prev])
    setNotice(`Message kept for ${compose.name}. Email them as well if you need a reply off-site.`)
    setDraft('')
    setCompose(null)
  }

  return (
    <main className="min-h-svh bg-ivory px-5 py-10 text-ink md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          <p className="text-xs font-medium tracking-[0.22em] text-sage-deep uppercase">
            Networking
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
            Community
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-charcoal/70">
            Groups working on seated and standing EHG. Email them, or leave a
            message here so the thread stays on VERA.
          </p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSoft, delay: 0.06 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor="community-search">
            Search groups
          </label>
          <input
            id="community-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search institution, city, or person…"
            className="min-w-0 flex-1 rounded-full bg-cream px-5 py-2.5 text-sm text-ink outline-none ring-1 ring-blush/60 placeholder:text-charcoal/40"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFocus('all')}
              className={PILL}
              style={{
                background: focus === 'all' ? UI.sageDeep : '#faf6f0',
                color: focus === 'all' ? '#faf6f0' : UI.charcoal,
              }}
            >
              All
            </button>
            {FOCUS_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFocus(tag)}
                className={PILL}
                style={{
                  background: focus === tag ? UI.sageDeep : '#faf6f0',
                  color: focus === tag ? '#faf6f0' : UI.charcoal,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.div>

        {notice && (
          <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-charcoal/70 ring-1 ring-blush/50">
            {notice}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group, i) => (
            <motion.article
              key={group.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.04 * i }}
              className="flex flex-col rounded-3xl bg-cream p-6 ring-1 ring-blush/60"
            >
              <p className="text-xs tracking-[0.16em] text-charcoal/40 uppercase">
                {group.city}, {group.country}
              </p>
              <h2 className="mt-2 font-display text-2xl font-medium text-ink">{group.name}</h2>
              <p className="mt-1 text-sm text-charcoal/65">{group.institution}</p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-charcoal/70">{group.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {group.focus.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-ivory px-2.5 py-0.5 text-xs text-charcoal/60 ring-1 ring-blush/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ink">{group.contact}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`mailto:${group.email}?subject=${encodeURIComponent('VERA community — ' + group.name)}`}
                  className="rounded-full px-4 py-2 text-sm font-medium text-cream"
                  style={{ background: UI.sageDeep }}
                >
                  Email
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCompose(group)
                    setNotice(null)
                  }}
                  className="rounded-full bg-ivory px-4 py-2 text-sm font-medium text-charcoal/75 ring-1 ring-blush/60"
                >
                  Message
                </button>
              </div>
            </motion.article>
          ))}
        </div>

        {groups.length === 0 && (
          <p className="text-sm text-charcoal/50">No groups match that search.</p>
        )}

        {sent.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl text-ink">Messages kept on VERA</h2>
            <ul className="space-y-2">
              {sent.map((note) => (
                <li
                  key={note.id}
                  className="rounded-2xl bg-cream px-4 py-3 text-sm ring-1 ring-blush/50"
                >
                  <p className="text-xs text-charcoal/45">
                    {note.at} · {note.groupName}
                  </p>
                  <p className="mt-1 text-charcoal/75">{note.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <AnimatePresence>
        {compose && (
          <>
            <motion.button
              type="button"
              aria-label="Close message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-charcoal/20"
              onClick={() => setCompose(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 110, damping: 29 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream p-8 ring-1 ring-blush/60"
              role="dialog"
              aria-labelledby="compose-title"
            >
              <p className="text-xs tracking-[0.16em] text-sage-deep uppercase">Message</p>
              <h2 id="compose-title" className="mt-2 font-display text-3xl text-ink">
                {compose.name}
              </h2>
              <p className="mt-1 text-sm text-charcoal/60">
                To {compose.contact} · stays on this device until you email them
              </p>
              <label className="sr-only" htmlFor="compose-body">
                Message body
              </label>
              <textarea
                id="compose-body"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={8}
                placeholder="Introduce yourself and what you want to share…"
                className="mt-6 min-h-40 flex-1 resize-none rounded-2xl bg-ivory p-4 text-sm text-ink outline-none ring-1 ring-blush/60 placeholder:text-charcoal/40"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={!draft.trim()}
                  className="rounded-full px-4 py-2 text-sm font-medium text-cream disabled:opacity-40"
                  style={{ background: UI.sageDeep }}
                >
                  Keep message
                </button>
                <button
                  type="button"
                  onClick={() => setCompose(null)}
                  className="rounded-full bg-ivory px-4 py-2 text-sm text-charcoal/70 ring-1 ring-blush/60"
                >
                  Cancel
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  )
}
