import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EventPage } from './pages/EventPage'
import { HomePage } from './pages/HomePage'
import { RsvpPage } from './pages/RsvpPage'
import { GatheringsProvider } from './store/GatheringsContext'

export default function App() {
  return (
    <GatheringsProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/events/:eventId" element={<EventPage />} />
            <Route path="/rsvp/:eventId" element={<RsvpPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </GatheringsProvider>
  )
}
