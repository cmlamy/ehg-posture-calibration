import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { askVera } from '../lib/veraAi'

type ChatMsg = {
  id: number
  role: 'user' | 'guide'
  text: string
  links?: { label: string; to: string }[]
}

const STARTERS = [
  'What is VERA?',
  'Who in the UK works on wearables?',
  'How does yesterday’s validation F1 relate to Community?',
]

export function SiteChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'guide',
      text: 'Ask across the whole instrument — Community, the research log, datasets, mechanisms, and the notes you write on a day’s report card.',
      links: [{ label: 'Community', to: '/community' }],
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, busy])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const userMsg: ChatMsg = { id: nextId.current++, role: 'user', text: trimmed }
    const history = [...messages, userMsg]
    setDraft('')
    setBusy(true)
    setMessages(history)
    void askVera(trimmed, history).then((reply) => {
      setMessages((cur) => [
        ...cur,
        {
          id: nextId.current++,
          role: 'guide',
          text: reply.answer,
          links: reply.links,
        },
      ])
      setBusy(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="vera-guide-panel"
        className="fixed right-5 bottom-5 z-40 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-cream shadow-sm md:right-7 md:bottom-7"
        style={{ background: UI.charcoal }}
      >
        <span aria-hidden className="text-base leading-none">
          {open ? '×' : '?'}
        </span>
        <span>{open ? 'Close guide' : 'Ask VERA'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="vera-guide-panel"
            role="dialog"
            aria-label="VERA guide"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={springSoft}
            className="fixed right-5 bottom-20 z-40 flex w-[min(100%-2.5rem,22rem)] flex-col overflow-hidden rounded-3xl bg-cream ring-1 ring-blush/70 md:right-7 md:bottom-24"
            style={{ height: 'min(32rem, calc(100svh - 8rem))' }}
          >
            <header className="border-b border-blush/50 px-5 py-4">
              <p className="text-xs font-medium tracking-[0.18em] text-sage-deep uppercase">
                Guide
              </p>
              <h2 className="mt-1 font-display text-xl text-ink">Ask across the site</h2>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={msg.role === 'user' ? 'ml-8 text-right' : 'mr-4'}
                >
                  <p
                    className="block w-full whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user' ? UI.charcoal : '#f4efe6',
                      color: msg.role === 'user' ? '#faf6f0' : UI.ink,
                    }}
                  >
                    {msg.text}
                  </p>
                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.links.map((link) =>
                        link.to.startsWith('mailto:') ? (
                          <a
                            key={link.to}
                            href={link.to}
                            className="rounded-full bg-ivory px-3 py-1 text-xs font-medium text-charcoal/70 ring-1 ring-blush/60 hover:text-ink"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setOpen(false)}
                            className="rounded-full bg-ivory px-3 py-1 text-xs font-medium text-charcoal/70 ring-1 ring-blush/60 hover:text-ink"
                          >
                            {link.label}
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <p className="mr-4 rounded-2xl px-3.5 py-2.5 text-left text-sm text-charcoal/50" style={{ background: '#f4efe6' }}>
                  Looking across Community, the log, and your notes…
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-blush/40 px-4 pt-3">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={busy}
                  className="rounded-full bg-ivory px-3 py-1 text-xs text-charcoal/65 ring-1 ring-blush/50 hover:text-ink disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2 px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault()
                send(draft)
              }}
            >
              <label className="sr-only" htmlFor="vera-guide-input">
                Question about VERA
              </label>
              <input
                id="vera-guide-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask across pages, groups, or a day’s notes…"
                className="min-w-0 flex-1 rounded-full bg-ivory px-4 py-2 text-sm text-ink outline-none ring-1 ring-blush/60 placeholder:text-charcoal/40"
                autoComplete="off"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full px-3 py-2 text-sm font-medium text-cream disabled:opacity-50"
                style={{ background: UI.sageDeep }}
              >
                Send
              </button>
            </form>
            <p className="px-5 pb-3 text-[11px] text-charcoal/40">
              Llama reads this site’s Community, log, datasets, and your day notes — not the open web.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
