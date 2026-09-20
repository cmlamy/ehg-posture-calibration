import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { Home } from './screens/Home'
import { Data } from './screens/Data'
import { Pipeline } from './screens/Pipeline'
import { Validation } from './screens/Validation'
import { Community } from './screens/Community'
import { ResearchLog } from './screens/ResearchLog'
import { Settings } from './screens/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/data" element={<Data />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/validation" element={<Validation />} />
          <Route path="/community" element={<Community />} />
          <Route path="/log" element={<ResearchLog />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
