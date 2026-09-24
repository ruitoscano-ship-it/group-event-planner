import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatDate, formatMoney } from '../lib/money'
import { useGatherings } from '../store/GatheringsContext'

export function RsvpPage() {
  const { eventId = '' } = useParams()
  const { getGathering, ensureGathering, addAttendee } = useGatherings()
  const gathering = getGathering(eventId)

  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [registeredBy, setRegisteredBy] = useState('')
  const [forSomeoneElse, setForSomeoneElse] = useState(false)
  const [menuItemIds, setMenuItemIds] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || gathering) {
      setFetching(false)
      return
    }
    let cancelled = false
    setFetching(true)
    void ensureGathering(eventId).then((g) => {
      if (cancelled) return
      setNotFound(!g)
      setFetching(false)
    })
    return () => {
      cancelled = true
    }
  }, [eventId, gathering, ensureGathering])

  const estimated = useMemo(() => {
    if (!gathering) return 0
    return menuItemIds.reduce((sum, id) => {
      const item = gathering.menu.find((m) => m.id === id)
      return sum + (item?.price ?? 0)
    }, 0)
  }, [gathering, menuItemIds])

  if (fetching) {
    return <div className="empty">Loading RSVP…</div>
  }

  if (notFound || !gathering) {
    return (
      <>
        <header className="topbar">
          <Link to="/" className="brand">
            <i className="brand-mark" aria-hidden />
            Round<span>.</span>
          </Link>
        </header>
        <div className="panel">
          <h2>Gathering not found</h2>
          <p className="sub">
            This RSVP link doesn’t match a live event. Ask the organizer to resend the link.
          </p>
          <Link className="btn btn-accent" to="/">
            Go home
          </Link>
        </div>
      </>
    )
  }

  function toggleItem(id: string) {
    setMenuItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!gathering || !name.trim() || saving) return
    const registrar = forSomeoneElse
      ? registeredBy.trim() || 'Someone'
      : name.trim()

    setSaving(true)
    setSubmitError(null)
    try {
      await addAttendee(gathering.id, {
        name: name.trim(),
        registeredBy: registrar,
        menuItemIds,
        allergies: allergies.trim(),
        notes: notes.trim(),
      })
      setSubmitted(true)
      setName('')
      setRegisteredBy('')
      setForSomeoneElse(false)
      setMenuItemIds([])
      setAllergies('')
      setNotes('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save RSVP')
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
        <Link className="btn btn-ghost btn-sm" to={`/events/${gathering.id}`}>
          Organizer view
        </Link>
      </header>

      <div className="page-header">
        <div>
          <div className="meta" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <span className="chip">{gathering.type}</span>
            <span className="chip chip-warm">{formatDate(gathering.date)}</span>
            {gathering.time && <span className="chip chip-muted">{gathering.time}</span>}
          </div>
          <h1>RSVP · {gathering.title}</h1>
          <p className="lede">
            {gathering.location || 'Location TBD'}
            {gathering.notes ? ` — ${gathering.notes}` : ''}
          </p>
        </div>
      </div>

      {submitted && (
        <div className="success-banner">
          You’re on the list. Add another guest below if you’re signing up for someone else too.
        </div>
      )}

      <div className="layout-split">
        <section className="panel">
          <h2>Register</h2>
          <p className="sub">Sign yourself up — or add a friend who can’t fill this in.</p>
          {submitError && <p className="allergy">{submitError}</p>}
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="form-grid">
              <label className="full">
                Guest name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                />
              </label>
              <label className="full paid-toggle" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={forSomeoneElse}
                  onChange={(e) => setForSomeoneElse(e.target.checked)}
                />
                I’m registering someone else
              </label>
              {forSomeoneElse && (
                <label className="full">
                  Your name
                  <input
                    required
                    value={registeredBy}
                    onChange={(e) => setRegisteredBy(e.target.value)}
                    placeholder="Who is filling this in?"
                  />
                </label>
              )}
              <label className="full">
                Allergies / dietary needs
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Nuts, gluten-free, vegetarian…"
                />
              </label>
              <label className="full">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Extra sauce, arriving late…"
                />
              </label>
            </div>

            <h3 style={{ margin: '1.25rem 0 0.65rem', fontFamily: 'var(--font-display)' }}>
              Pick from the menu
            </h3>
            {gathering.menu.length === 0 ? (
              <div className="empty">The organizer hasn’t added menu options yet.</div>
            ) : (
              <div className="menu-picker">
                {gathering.menu.map((item) => {
                  const selected = menuItemIds.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`menu-option ${selected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleItem(item.id)}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <br />
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                          {item.category}
                          {item.description ? ` · ${item.description}` : ''}
                        </span>
                      </span>
                      <span className="price">
                        {formatMoney(item.price, gathering.currency)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <strong>
                Estimated:{' '}
                <span className="price">{formatMoney(estimated, gathering.currency)}</span>
              </strong>
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Confirm RSVP'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Already coming ({gathering.attendees.length})</h2>
          <p className="sub">Live list of who’s registered so far.</p>
          {gathering.attendees.length === 0 ? (
            <div className="empty">Be the first to RSVP.</div>
          ) : (
            <div className="guest-list">
              {gathering.attendees.map((a) => (
                <div key={a.id} className="guest-row">
                  <h4>{a.name}</h4>
                  <p>
                    {a.menuItemIds.length} menu pick
                    {a.menuItemIds.length === 1 ? '' : 's'}
                    {a.allergies ? (
                      <>
                        {' · '}
                        <span className="allergy">{a.allergies}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
