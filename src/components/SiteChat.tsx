import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { springSoft } from '../lib/motion'
import { UI } from '../lib/palette'
import { answerQuestion, GUIDE } from '../lib/veraGuide'

type ChatMsg = {
  id: number
  role: 'user' | 'guide'
  text: string
  links?: { label: string; to: string }[]
}

const STARTERS = ['What is VERA?', 'How does sitting work?', 'How do I contact a group?']

export function SiteChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0,
      role: 'guide',
      text: 'I can walk you through VERA — the pages, the posture graph, the datasets, or how to reach another group.',
      links: [{ label: 'Community', to: '/community' }],
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const reply = answerQuestion(trimmed)
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: 'user', text: trimmed },
      {
        id: prev.length + 2,
        role: 'guide',
        text: reply.answer,
        links: reply.links,
      },
    ])
    setDraft('')
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
              <h2 className="mt-1 font-display text-xl text-ink">Ask about the site</h2>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={msg.role === 'user' ? 'ml-8 text-right' : 'mr-4'}
                >
                  <p
                    className="inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed"
                    style={{
                      background: msg.role === 'user' ? UI.charcoal : '#f4efe6',
                      color: msg.role === 'user' ? '#faf6f0' : UI.ink,
                    }}
                  >
                    {msg.text}
                  </p>
                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.links.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setOpen(false)}
                          className="rounded-full bg-ivory px-3 py-1 text-xs font-medium text-charcoal/70 ring-1 ring-blush/60 hover:text-ink"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-blush/40 px-4 pt-3">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full bg-ivory px-3 py-1 text-xs text-charcoal/65 ring-1 ring-blush/50 hover:text-ink"
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
                placeholder="Ask about a page or a control…"
                className="min-w-0 flex-1 rounded-full bg-ivory px-4 py-2 text-sm text-ink outline-none ring-1 ring-blush/60 placeholder:text-charcoal/40"
                autoComplete="off"
              />
              <button
                type="submit"
                className="rounded-full px-3 py-2 text-sm font-medium text-cream"
                style={{ background: UI.sageDeep }}
              >
                Send
              </button>
            </form>
            <p className="px-5 pb-3 text-[11px] text-charcoal/40">
              {GUIDE.length} topics on this instrument — not the open web.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
