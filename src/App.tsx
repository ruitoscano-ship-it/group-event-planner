import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageLayout } from './components/PageLayout'
import { I18nProvider } from './i18n/I18nContext'
import { AdminPage } from './pages/AdminPage'
import { EventPage } from './pages/EventPage'
import { HomePage } from './pages/HomePage'
import { RsvpPage } from './pages/RsvpPage'
import { GatheringsProvider } from './store/GatheringsContext'

export default function App() {
  return (
    <I18nProvider>
      <GatheringsProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Routes>
              <Route element={<PageLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/events/:eventId" element={<EventPage />} />
                <Route path="/rsvp/:eventId" element={<RsvpPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </div>
        </BrowserRouter>
      </GatheringsProvider>
    </I18nProvider>
  )
}
