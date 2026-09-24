import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDate, formatMoney, gatheringTotals } from '../lib/money'
import { useGatherings } from '../store/GatheringsContext'
import type { GatheringInput } from '../types'

const emptyForm: GatheringInput = {
  title: '',
  type: 'lunch',
  date: '',
  time: '13:00',
  location: '',
  notes: '',
  currency: 'EUR',
}

export function HomePage() {
  const { gatherings, createGathering, loading, error, refresh } = useGatherings()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<GatheringInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    setFormError(null)
    try {
      const created = await createGathering({
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
      })
      setForm(emptyForm)
      setShowForm(false)
      navigate(`/events/${created.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create gathering')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <i className="brand-mark" aria-hidden />
          Round<span>.</span>
        </Link>
        <div className="nav-actions">
          <button className="btn btn-accent" type="button" onClick={() => setShowForm(true)}>
            New gathering
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="brand">
            Round<span>.</span>
          </p>
          <p className="hero-lede">
            Plan lunches and dinners with friends — set the menu, let everyone RSVP
            themselves, track allergies, and see who still owes.
          </p>
          <div className="nav-actions">
            <button className="btn btn-accent" type="button" onClick={() => setShowForm(true)}>
              Create an event
            </button>
            {gatherings.length > 0 && (
              <a className="btn btn-ghost" href="#upcoming">
                View gatherings
              </a>
            )}
          </div>
        </div>
        <div className="hero-visual" role="img" aria-label="Friends gathered around a table" />
      </section>

      {error && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h3>Couldn’t sync</h3>
          <p className="sub">{error}</p>
          <button className="btn btn-accent btn-sm" type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {showForm && (
        <section className="section panel">
          <h2>Create gathering</h2>
          <p className="sub">Add the basics first — you can upload the menu next.</p>
          {formError && <p className="allergy">{formError}</p>}
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="form-grid">
              <label className="full">
                Title
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Friday team lunch"
                />
              </label>
              <label>
                Type
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as GatheringInput['type'],
                    })
                  }
                >
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="brunch">Brunch</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Currency
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="CHF">CHF</option>
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="full">
                Location
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Office kitchen / Café Central"
                />
              </label>
              <label className="full">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Bring cash, or pay via Revolut…"
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save & add menu'}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section" id="upcoming">
        <div className="section-head">
          <div>
            <h2>Your gatherings</h2>
            <p>Menus, RSVPs, allergies, and payments — synced for your whole group.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading gatherings…</div>
        ) : gatherings.length === 0 ? (
          <div className="empty">
            No gatherings yet. Create one and share the RSVP link with your group.
          </div>
        ) : (
          <div className="event-grid">
            {gatherings.map((g) => {
              const totals = gatheringTotals(g)
              return (
                <Link key={g.id} to={`/events/${g.id}`} className="event-tile">
                  <div className="meta">
                    <span className="chip">{g.type}</span>
                    <span className="chip chip-warm">{formatDate(g.date)}</span>
                    {g.time && <span className="chip chip-muted">{g.time}</span>}
                  </div>
                  <h3>{g.title}</h3>
                  <p className="detail">
                    {g.location || 'Location TBD'}
                    {g.menu.length > 0 ? ` · ${g.menu.length} menu items` : ' · Menu empty'}
                  </p>
                  <div className="stats">
                    <div className="stat">
                      <strong>{totals.guestCount}</strong>
                      <span>Guests</span>
                    </div>
                    <div className="stat">
                      <strong>{formatMoney(totals.owed, g.currency)}</strong>
                      <span>Total</span>
                    </div>
                    <div className="stat">
                      <strong>{formatMoney(totals.outstanding, g.currency)}</strong>
                      <span>Due</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
