import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  attendeeTotal,
  formatDate,
  formatMoney,
  gatheringTotals,
  menuLabel,
} from '../lib/money'
import { useGatherings } from '../store/GatheringsContext'

type Tab = 'menu' | 'guests' | 'payments'

export function EventPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const {
    getGathering,
    ensureGathering,
    loading,
    deleteGathering,
    addMenuItem,
    removeMenuItem,
    updateAttendee,
    removeAttendee,
  } = useGatherings()
  const gathering = getGathering(eventId)
  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('menu')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Mains',
  })

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

  const totals = useMemo(
    () => (gathering ? gatheringTotals(gathering) : null),
    [gathering],
  )

  if (fetching || (loading && !gathering)) {
    return <div className="empty">Loading gathering…</div>
  }

  if (notFound || !gathering || !totals) {
    return (
      <div className="panel">
        <h2>Gathering not found</h2>
        <p className="sub">This event may have been deleted.</p>
        <Link className="btn btn-accent" to="/">
          Go home
        </Link>
      </div>
    )
  }

  const rsvpUrl = `${window.location.origin}/rsvp/${gathering.id}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function onAddMenu(e: FormEvent) {
    e.preventDefault()
    if (!gathering) return
    const price = Number(menuForm.price)
    if (!menuForm.name.trim() || Number.isNaN(price) || price < 0 || busy) return
    setBusy(true)
    try {
      await addMenuItem(gathering.id, {
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        price,
        category: menuForm.category.trim() || 'Mains',
      })
      setMenuForm({ name: '', description: '', price: '', category: menuForm.category })
    } finally {
      setBusy(false)
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
          <Link className="btn btn-ghost" to={`/rsvp/${gathering.id}`}>
            Open RSVP
          </Link>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            onClick={() => {
              void (async () => {
                if (!confirm('Delete this gathering?')) return
                await deleteGathering(gathering.id)
                navigate('/')
              })()
            }}
          >
            Delete
          </button>
        </div>
      </header>

      <div className="page-header">
        <div>
          <div className="meta" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <span className="chip">{gathering.type}</span>
            <span className="chip chip-warm">{formatDate(gathering.date)}</span>
            {gathering.time && <span className="chip chip-muted">{gathering.time}</span>}
          </div>
          <h1>{gathering.title}</h1>
          <p className="lede">
            {gathering.location || 'Location TBD'}
            {gathering.notes ? ` — ${gathering.notes}` : ''}
          </p>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-tile">
          <span>Guests</span>
          <strong>{totals.guestCount}</strong>
        </div>
        <div className="summary-tile">
          <span>Menu total</span>
          <strong>{formatMoney(totals.owed, gathering.currency)}</strong>
        </div>
        <div className="summary-tile">
          <span>Collected</span>
          <strong>{formatMoney(totals.paid, gathering.currency)}</strong>
        </div>
        <div className="summary-tile">
          <span>Still due</span>
          <strong>{formatMoney(totals.outstanding, gathering.currency)}</strong>
        </div>
      </div>

      <div className="share-box">
        <strong>Self-service link</strong>
        <code>{rsvpUrl}</code>
        <button className="btn btn-sm btn-accent" type="button" onClick={() => void copyLink()}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="tabs">
        {(['menu', 'guests', 'payments'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'menu' ? 'Menu' : t === 'guests' ? 'Guests' : 'Payments'}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <div className="layout-split">
          <section className="panel">
            <h2>Add menu option</h2>
            <p className="sub">Each item has a preset cost used for billing.</p>
            <form onSubmit={(e) => void onAddMenu(e)}>
              <div className="form-grid">
                <label className="full">
                  Name
                  <input
                    required
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    placeholder="Chicken burrito"
                  />
                </label>
                <label>
                  Category
                  <input
                    value={menuForm.category}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, category: e.target.value })
                    }
                    placeholder="Mains"
                  />
                </label>
                <label>
                  Price ({gathering.currency})
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    placeholder="12.50"
                  />
                </label>
                <label className="full">
                  Description
                  <textarea
                    value={menuForm.description}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, description: e.target.value })
                    }
                    placeholder="With rice, beans, salsa…"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-accent" type="submit" disabled={busy}>
                  {busy ? 'Adding…' : 'Add to menu'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>Current menu</h2>
            <p className="sub">{gathering.menu.length} options available to guests.</p>
            {gathering.menu.length === 0 ? (
              <div className="empty">Add at least one option before sharing the RSVP link.</div>
            ) : (
              <div className="menu-list">
                {gathering.menu.map((item) => (
                  <div key={item.id} className="menu-row">
                    <div>
                      <span className="chip chip-muted">{item.category}</span>
                      <h4>{item.name}</h4>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="price">
                        {formatMoney(item.price, gathering.currency)}
                      </div>
                      <div className="row-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          onClick={() => void removeMenuItem(gathering.id, item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'guests' && (
        <section className="panel">
          <h2>Who’s coming</h2>
          <p className="sub">
            Guests register via the self-service link. You can also remove entries here.
          </p>
          {gathering.attendees.length === 0 ? (
            <div className="empty">No RSVPs yet. Share the link so people can sign up.</div>
          ) : (
            <div className="guest-list">
              {gathering.attendees.map((a) => {
                const owed = attendeeTotal(a, gathering.menu)
                return (
                  <div key={a.id} className="guest-row">
                    <div>
                      <h4>{a.name}</h4>
                      <p>
                        Registered by {a.registeredBy}
                        {a.registeredBy !== a.name ? ' (for someone else)' : ''}
                      </p>
                      <div className="guest-meta">
                        <span className="chip">{menuLabel(a.menuItemIds, gathering.menu)}</span>
                        <span className="chip chip-warm">
                          {formatMoney(owed, gathering.currency)}
                        </span>
                        {a.allergies && (
                          <span className="chip" style={{ background: '#f8d7d7', color: '#a33b3b' }}>
                            Allergy: {a.allergies}
                          </span>
                        )}
                      </div>
                      {a.notes && <p style={{ marginTop: '0.5rem' }}>{a.notes}</p>}
                    </div>
                    <div className="row-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        onClick={() => void removeAttendee(gathering.id, a.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="panel">
          <h2>Payment tracking</h2>
          <p className="sub">
            Owed amounts come from menu selections. Mark people as paid or enter a partial amount.
          </p>
          {gathering.attendees.length === 0 ? (
            <div className="empty">No guests to bill yet.</div>
          ) : (
            <div className="guest-list">
              {gathering.attendees.map((a) => {
                const owed = attendeeTotal(a, gathering.menu)
                const remaining = Math.max(0, owed - a.amountPaid)
                const settled = remaining <= 0.001
                return (
                  <div key={a.id} className="guest-row">
                    <div>
                      <h4>{a.name}</h4>
                      <p>{menuLabel(a.menuItemIds, gathering.menu)}</p>
                      <div className="guest-meta">
                        <span className="chip chip-muted">
                          Owes {formatMoney(owed, gathering.currency)}
                        </span>
                        <span className={`chip ${settled ? '' : 'chip-warm'}`}>
                          {settled
                            ? 'Paid in full'
                            : `Due ${formatMoney(remaining, gathering.currency)}`}
                        </span>
                      </div>
                      <div className="money-inputs">
                        <label>
                          Amount paid
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={a.amountPaid}
                            onChange={(e) =>
                              void updateAttendee(gathering.id, a.id, {
                                amountPaid: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </label>
                        <div className="row-actions">
                          <button
                            className="btn btn-sm btn-accent"
                            type="button"
                            onClick={() =>
                              void updateAttendee(gathering.id, a.id, { amountPaid: owed })
                            }
                          >
                            Mark paid
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            type="button"
                            onClick={() =>
                              void updateAttendee(gathering.id, a.id, { amountPaid: 0 })
                            }
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </>
  )
}
