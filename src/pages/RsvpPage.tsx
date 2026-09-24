import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import {
  attendeeUnitPrice,
  formatDate,
  formatMoney,
  partySize,
} from '../lib/money'
import { useGatherings } from '../store/GatheringsContext'

export function RsvpPage() {
  const { eventId = '' } = useParams()
  const { t, localeTag } = useI18n()
  const { getGathering, ensureGathering, addAttendee } = useGatherings()
  const gathering = getGathering(eventId)

  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [name, setName] = useState('')
  const [registeredBy, setRegisteredBy] = useState('')
  const [forSomeoneElse, setForSomeoneElse] = useState(false)
  const [asGroup, setAsGroup] = useState(false)
  const [groupSize, setGroupSize] = useState(2)
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
    const fake = {
      id: '',
      name: '',
      registeredBy: '',
      menuItemIds,
      allergies: '',
      notes: '',
      amountPaid: 0,
      createdAt: '',
      isGroup: asGroup,
      groupSize: asGroup ? groupSize : 1,
    }
    return attendeeUnitPrice(fake, gathering.menu) * partySize(fake)
  }, [gathering, menuItemIds, asGroup, groupSize])

  const hasAlaCartePick = useMemo(() => {
    if (!gathering) return false
    return menuItemIds.some((id) => gathering.menu.find((m) => m.id === id)?.isAlaCarte)
  }, [gathering, menuItemIds])

  if (fetching) {
    return <div className="empty">{t('loadingRsvp')}</div>
  }

  if (notFound || !gathering) {
    return (
      <>
        <header className="topbar">
          <Link viewTransition to="/" className="brand">
            <i className="brand-mark" aria-hidden />
            Round<span>.</span>
          </Link>
          <LanguageSwitcher />
        </header>
        <div className="panel">
          <h2>{t('gatheringNotFound')}</h2>
          <p className="sub">{t('rsvpNotFoundSub')}</p>
          <Link viewTransition className="btn btn-accent" to="/">
            {t('goHome')}
          </Link>
        </div>
      </>
    )
  }

  const typeLabel =
    gathering.type === 'lunch'
      ? t('typeLunch')
      : gathering.type === 'dinner'
        ? t('typeDinner')
        : gathering.type === 'brunch'
          ? t('typeBrunch')
          : t('typeOther')

  function toggleItem(id: string) {
    if (!gathering) return
    const item = gathering.menu.find((m) => m.id === id)
    if (!item) return

    setMenuItemIds((prev) => {
      const selected = prev.includes(id)
      if (selected) return prev.filter((x) => x !== id)

      if (item.isAlaCarte) {
        // À la carte is exclusive vs fixed menus
        return [id]
      }
      // Fixed menus clear any à la carte pick
      const withoutAla = prev.filter(
        (x) => !gathering.menu.find((m) => m.id === x)?.isAlaCarte,
      )
      return [...withoutAla, id]
    })
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
        isGroup: asGroup,
        groupSize: asGroup ? Math.max(1, groupSize) : 1,
      })
      setSubmitted(true)
      setName('')
      setRegisteredBy('')
      setForSomeoneElse(false)
      setAsGroup(false)
      setGroupSize(2)
      setMenuItemIds([])
      setAllergies('')
      setNotes('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('rsvpSaveFailed'))
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
          <Link viewTransition className="btn btn-ghost btn-sm" to={`/events/${gathering.id}`}>
            {t('organizerView')}
          </Link>
        </div>
      </header>

      <div className="page-header">
        <div>
          <div className="meta" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <span className="chip">{typeLabel}</span>
            <span className="chip chip-warm">
              {formatDate(gathering.date, localeTag, t('dateTbd'))}
            </span>
            {gathering.time && <span className="chip chip-muted">{gathering.time}</span>}
          </div>
          <h1>{t('rsvpTitle', { title: gathering.title })}</h1>
          <p className="lede">
            {gathering.location || t('locationTbd')}
            {gathering.notes ? ` — ${gathering.notes}` : ''}
          </p>
        </div>
      </div>

      {gathering.menuCardUrl && (
        <div className="menu-card-preview panel" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display)' }}>
            {t('menuCard')}
          </h3>
          <img src={gathering.menuCardUrl} alt={t('menuCard')} />
          {!gathering.menuCardUrl.startsWith('data:') && (
            <a
              className="btn btn-ghost btn-sm"
              href={gathering.menuCardUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t('menuCardOpen')}
            </a>
          )}
        </div>
      )}

      {submitted && <div className="success-banner">{t('successBanner')}</div>}

      <div className="layout-split">
        <section className="panel">
          <h2>{t('register')}</h2>
          <p className="sub">{t('registerSub')}</p>
          {submitError && <p className="allergy">{submitError}</p>}
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="form-grid">
              <label className="full">
                {asGroup ? t('groupName') : t('guestName')}
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={asGroup ? t('groupNamePlaceholder') : 'Alex'}
                />
              </label>
              <label className="full paid-toggle" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={asGroup}
                  onChange={(e) => setAsGroup(e.target.checked)}
                />
                {t('registeringAsGroup')}
              </label>
              {asGroup && (
                <label>
                  {t('groupSize')}
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={groupSize}
                    onChange={(e) => setGroupSize(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
              )}
              <label className="full paid-toggle" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={forSomeoneElse}
                  onChange={(e) => setForSomeoneElse(e.target.checked)}
                />
                {t('registeringSomeoneElse')}
              </label>
              {forSomeoneElse && (
                <label className="full">
                  {t('yourName')}
                  <input
                    required
                    value={registeredBy}
                    onChange={(e) => setRegisteredBy(e.target.value)}
                    placeholder={t('placeholderRegistrar')}
                  />
                </label>
              )}
              <label className="full">
                {t('allergiesDietary')}
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder={t('placeholderAllergies')}
                />
              </label>
              <label className="full">
                {t('notes')}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('placeholderGuestNotes')}
                />
              </label>
            </div>

            <h3 style={{ margin: '1.25rem 0 0.35rem', fontFamily: 'var(--font-display)' }}>
              {t('pickFromMenu')}
            </h3>
            <p className="sub">{t('pickMenuOrAlaCarte')}</p>
            {gathering.menu.length === 0 ? (
              <div className="empty">{t('organizerNoMenu')}</div>
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
                        {item.isAlaCarte && (
                          <>
                            {' '}
                            <span className="chip chip-warm">{t('alaCarte')}</span>
                          </>
                        )}
                        <br />
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                          {item.category}
                          {item.description ? ` · ${item.description}` : ''}
                        </span>
                      </span>
                      <span className="price">
                        {item.isAlaCarte
                          ? t('priceVariable')
                          : formatMoney(item.price, gathering.currency, localeTag)}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <strong>
                {hasAlaCartePick ? t('estimatedVariable') : t('estimated')}{' '}
                <span className="price">
                  {formatMoney(estimated, gathering.currency, localeTag)}
                </span>
                {asGroup && (
                  <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {' '}
                    · {groupSize}{' '}
                    {groupSize === 1 ? t('personLabel') : t('peopleLabel')}
                  </span>
                )}
              </strong>
              <button className="btn btn-accent" type="submit" disabled={saving}>
                {saving ? t('saving') : t('confirmRsvp')}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>
            {t('alreadyComing', {
              count: gathering.attendees.reduce((sum, a) => sum + partySize(a), 0),
            })}
          </h2>
          <p className="sub">{t('alreadyComingSub')}</p>
          {gathering.attendees.length === 0 ? (
            <div className="empty">{t('beFirst')}</div>
          ) : (
            <div className="guest-list">
              {gathering.attendees.map((a) => (
                <div key={a.id} className="guest-row">
                  <h4>{a.name}</h4>
                  <p>
                    {a.isGroup && (
                      <>
                        {t('groupBadge', { count: partySize(a) })}
                        {' · '}
                      </>
                    )}
                    {a.menuItemIds.length === 1
                      ? t('menuPick', { count: a.menuItemIds.length })
                      : t('menuPicks', { count: a.menuItemIds.length })}
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
