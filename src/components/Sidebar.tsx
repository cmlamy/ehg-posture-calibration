import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { springSoft } from '../lib/motion'

const NAV_ITEMS = [
  { to: '/', label: 'Home', exact: true },
  { to: '/data', label: 'Data' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/validation', label: 'Validation' },
  { to: '/community', label: 'Community' },
  { to: '/log', label: 'Research Log' },
  { to: '/settings', label: 'Settings' },
]

export function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 196 }}
      transition={springSoft}
      className="relative flex h-svh flex-col border-r border-blush-deep/40 bg-cream py-8"
      style={{ flexShrink: 0, overflow: 'hidden' }}
    >
      {/* Wordmark */}
      <div className="mb-8 flex items-center gap-2 px-4">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-charcoal text-cream"
          style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          V
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              key="wordmark"
              initial={{ opacity: 0, x: -1 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -1 }}
              transition={{ duration: 0.18 }}
              className="font-display text-sm font-semibold tracking-[0.18em] text-ink"
              style={{ whiteSpace: 'nowrap' }}
              title="Vertical EHG Response Adaptation"
            >
              VERA
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ to, label, exact }) => {
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to)

          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
              style={{
                color: isActive ? '#2c2826' : '#8a7f7a',
                background: isActive ? '#ead5d0' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: '#ead5d0' }}
                  transition={springSoft}
                />
              )}

              {/* Dot icon */}
              <span
                className="relative z-10 h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors"
                style={{ background: isActive ? '#3a3532' : '#d9b8b2' }}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    key={`label-${to}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="relative z-10 whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="mx-auto mt-4 flex h-7 w-7 items-center justify-center rounded-full border border-blush-deep/50 bg-cream text-charcoal/50 transition-colors hover:border-charcoal/30 hover:text-charcoal"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        >
          <path
            d="M7 2L3 6L7 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </motion.aside>
  )
}
