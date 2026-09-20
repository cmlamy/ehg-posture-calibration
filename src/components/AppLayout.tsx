import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { SiteChat } from './SiteChat'
import { IntroSplash } from './IntroSplash'

export function AppLayout() {
  const [showIntro, setShowIntro] = useState(true)

  return (
    <div className="flex h-svh overflow-hidden bg-ivory">
      <AnimatePresence>
        {showIntro && <IntroSplash key="intro" onEnter={() => setShowIntro(false)} />}
      </AnimatePresence>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      {!showIntro && <SiteChat />}
    </div>
  )
}
