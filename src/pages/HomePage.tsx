import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
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
  const { t, localeTag } = useI18n()
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
      navigate(`/events/${created.id}`, { viewTransition: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <Link viewTransition to="/" className="brand">
          <i className="brand-mark" aria-hidden />
          Round<span>.</span>
        </Link>
        <div className="nav-actions">
          <LanguageSwitcher />
          <button className="btn btn-accent" type="button" onClick={() => setShowForm(true)}>
            {t('newGathering')}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="brand">
            Round<span>.</span>
          </p>
          <p className="hero-lede">{t('heroLede')}</p>
          <div className="nav-actions">
            <button className="btn btn-accent" type="button" onClick={() => setShowForm(true)}>
              {t('createEvent')}
            </button>
            {gatherings.length > 0 && (
              <a className="btn btn-ghost" href="#upcoming">
                {t('viewGatherings')}
              </a>
            )}
          </div>
        </div>
        <div className="hero-visual" role="img" aria-label={t('brandAria')} />
      </section>

      {error && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h3>{t('syncErrorTitle')}</h3>
          <p className="sub">{error}</p>
          <button className="btn btn-accent btn-sm" type="button" onClick={() => void refresh()}>
            {t('retry')}
          </button>
        </div>
      )}

      {showForm && (
        <section className="section panel">
          <h2>{t('createGathering')}</h2>
          <p className="sub">{t('createGatheringSub')}</p>
          {formError && <p className="allergy">{formError}</p>}
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="form-grid">
              <label className="full">
                {t('title')}
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('placeholderTitle')}
                />
              </label>
              <label>
                {t('type')}
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as GatheringInput['type'],
                    })
                  }
                >
                  <option value="lunch">{t('typeLunch')}</option>
                  <option value="dinner">{t('typeDinner')}</option>
                  <option value="brunch">{t('typeBrunch')}</option>
                  <option value="other">{t('typeOther')}</option>
                </select>
              </label>
              <label>
                {t('currency')}
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
                {t('date')}
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>
                {t('time')}
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="full">
                {t('location')}
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={t('placeholderLocation')}
                />
              </label>
              <label className="full">
                {t('notes')}
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('placeholderNotes')}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? t('saving') : t('saveAndAddMenu')}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowForm(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section" id="upcoming">
        <div className="section-head">
          <div>
            <h2>{t('yourGatherings')}</h2>
            <p>{t('yourGatheringsSub')}</p>
          </div>
        </div>

        {loading ? (
          <div className="empty">{t('loadingGatherings')}</div>
        ) : gatherings.length === 0 ? (
          <div className="empty">{t('noGatherings')}</div>
        ) : (
          <div className="event-grid">
            {gatherings.map((g) => {
              const totals = gatheringTotals(g)
              const typeLabel =
                g.type === 'lunch'
                  ? t('typeLunch')
                  : g.type === 'dinner'
                    ? t('typeDinner')
                    : g.type === 'brunch'
                      ? t('typeBrunch')
                      : t('typeOther')
              return (
                <Link viewTransition key={g.id} to={`/events/${g.id}`} className="event-tile">
                  <div className="meta">
                    <span className="chip">{typeLabel}</span>
                    <span className="chip chip-warm">
                      {formatDate(g.date, localeTag, t('dateTbd'))}
                    </span>
                    {g.time && <span className="chip chip-muted">{g.time}</span>}
                  </div>
                  <h3>{g.title}</h3>
                  <p className="detail">
                    {g.location || t('locationTbd')}
                    {g.menu.length > 0
                      ? ` · ${t('menuItems', { count: g.menu.length })}`
                      : ` · ${t('menuEmpty')}`}
                  </p>
                  <div className="stats">
                    <div className="stat">
                      <strong>{totals.guestCount}</strong>
                      <span>{t('guests')}</span>
                    </div>
                    <div className="stat">
                      <strong>{formatMoney(totals.owed, g.currency, localeTag)}</strong>
                      <span>{t('total')}</span>
                    </div>
                    <div className="stat">
                      <strong>
                        {formatMoney(totals.outstanding, g.currency, localeTag)}
                      </strong>
                      <span>{t('due')}</span>
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
