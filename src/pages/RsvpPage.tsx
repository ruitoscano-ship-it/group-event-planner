import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MenuPicker } from '../components/MenuPicker'
import { useI18n } from '../i18n/I18nContext'
import {
  attendeeTotal,
  createMemberDraft,
  formatDate,
  formatMoney,
  idsHaveAlaCarte,
  menuLabel,
  partySize,
  toggleMenuSelection,
  unitPriceForIds,
} from '../lib/money'
import { pickFeedback, rsvpSuccessKeys } from '../lib/feedback'
import { useGatherings } from '../store/GatheringsContext'
import type { GroupMember } from '../types'

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
  const [members, setMembers] = useState<GroupMember[]>(() => [
    createMemberDraft(),
    createMemberDraft(),
  ])
  const [menuItemIds, setMenuItemIds] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
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
    if (asGroup) {
      return members.reduce((sum, m) => sum + unitPriceForIds(m.menuItemIds, gathering.menu), 0)
    }
    return unitPriceForIds(menuItemIds, gathering.menu)
  }, [gathering, asGroup, members, menuItemIds])

  const hasAlaCartePick = useMemo(() => {
    if (!gathering) return false
    if (asGroup) {
      return members.some((m) => idsHaveAlaCarte(m.menuItemIds, gathering.menu))
    }
    return idsHaveAlaCarte(menuItemIds, gathering.menu)
  }, [gathering, asGroup, members, menuItemIds])

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

  function updateMember(id: string, patch: Partial<GroupMember>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function toggleMemberMenu(memberId: string, itemId: string) {
    if (!gathering) return
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              menuItemIds: toggleMenuSelection(m.menuItemIds, itemId, gathering.menu),
            }
          : m,
      ),
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!gathering || !name.trim() || saving) return
    const registrar = forSomeoneElse
      ? registeredBy.trim() || 'Someone'
      : name.trim()

    if (asGroup) {
      if (members.length === 0) {
        setSubmitError(t('needMembers'))
        return
      }
      const incomplete = members.some((m) => !m.name.trim() || m.menuItemIds.length === 0)
      if (incomplete) {
        setSubmitError(t('needMemberMenus'))
        return
      }
    }

    setSaving(true)
    setSubmitError(null)
    try {
      await addAttendee(gathering.id, {
        name: name.trim(),
        registeredBy: registrar,
        email: email.trim(),
        phone: phone.trim(),
        menuItemIds: asGroup ? [] : menuItemIds,
        allergies: asGroup ? '' : allergies.trim(),
        notes: notes.trim(),
        isGroup: asGroup,
        groupSize: asGroup ? members.length : 1,
        members: asGroup
          ? members.map((m) => ({
              ...m,
              name: m.name.trim(),
              allergies: m.allergies.trim(),
            }))
          : [],
      })
      setSuccessMessage(pickFeedback(t, [...rsvpSuccessKeys]))
      setSubmitted(true)
      setName('')
      setRegisteredBy('')
      setForSomeoneElse(false)
      setAsGroup(false)
      setMembers([createMemberDraft(), createMemberDraft()])
      setMenuItemIds([])
      setAllergies('')
      setEmail('')
      setPhone('')
      setNotes('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
        </div>
      </header>

      <div className="event-summary-card">
        <h2>{gathering.title}</h2>
        <p>
          {typeLabel}
          {' · '}
          {formatDate(gathering.date, localeTag, t('dateTbd'))}
          {gathering.time ? ` · ${gathering.time}` : ''}
          {' · '}
          {gathering.location || t('locationTbd')}
        </p>
      </div>

      <div className="page-header desktop-page-header">
        <div>
          <div
            className="meta"
            style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}
          >
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
        <details className="collapsible-details">
          <summary>{t('viewMenuCard')}</summary>
          <div className="menu-card-preview">
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
        </details>
      )}

      {submitted && (
        <div className="feedback-banner" role="status">
          {successMessage || t('feedbackRsvp1')}
        </div>
      )}
      {submitError && (
        <div className="feedback-banner error" role="alert">
          {submitError}
        </div>
      )}

      <div className="layout-split rsvp-layout">
        <section className="panel">
          <h2>{t('register')}</h2>
          <p className="sub">{t('registerSub')}</p>
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="form-grid">
              <label className="full">
                {asGroup ? t('groupName') : t('guestName')}
                <input
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={asGroup ? t('groupNamePlaceholder') : 'Alex'}
                />
              </label>
              <label className="full paid-toggle">
                <input
                  type="checkbox"
                  checked={asGroup}
                  onChange={(e) => {
                    const next = e.target.checked
                    setAsGroup(next)
                    if (next && members.length === 0) {
                      setMembers([createMemberDraft(), createMemberDraft()])
                    }
                  }}
                />
                {t('registeringAsGroup')}
              </label>
              <label className="full paid-toggle">
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
                    autoComplete="name"
                    value={registeredBy}
                    onChange={(e) => setRegisteredBy(e.target.value)}
                    placeholder={t('placeholderRegistrar')}
                  />
                </label>
              )}
              <label>
                {t('emailOptional')}
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('placeholderEmail')}
                />
              </label>
              <label>
                {t('phoneOptional')}
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('placeholderPhone')}
                />
              </label>
              {!asGroup && (
                <>
                  <label className="full">
                    {t('allergiesDietary')}
                    <input
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder={t('placeholderAllergies')}
                      enterKeyHint="next"
                    />
                  </label>
                </>
              )}
              <label className="full">
                {t('notes')}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('placeholderGuestNotes')}
                />
              </label>
            </div>

            {asGroup ? (
              <>
                <h3 style={{ margin: '1.25rem 0 0.35rem', fontFamily: 'var(--font-display)' }}>
                  {t('groupMembersTitle')}
                </h3>
                <p className="sub">{t('groupMembersSub')}</p>
                <div className="member-list">
                  {members.map((member, index) => (
                    <div key={member.id} className="member-card">
                      <div className="member-card-head">
                        <h4>{t('memberLabel', { n: index + 1 })}</h4>
                        {members.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              setMembers((prev) => prev.filter((m) => m.id !== member.id))
                            }
                          >
                            {t('removeMember')}
                          </button>
                        )}
                      </div>
                      <label>
                        {t('memberName')}
                        <input
                          required
                          value={member.name}
                          onChange={(e) => updateMember(member.id, { name: e.target.value })}
                          placeholder={t('memberNamePlaceholder')}
                          autoComplete="name"
                        />
                      </label>
                      <label>
                        {t('allergiesDietary')}
                        <input
                          value={member.allergies}
                          onChange={(e) =>
                            updateMember(member.id, { allergies: e.target.value })
                          }
                          placeholder={t('placeholderAllergies')}
                        />
                      </label>
                      <div>
                        <p className="sub" style={{ marginBottom: '0.5rem' }}>
                          {t('memberMenu')}
                        </p>
                        <p className="sub">{t('pickMenuOrAlaCarte')}</p>
                        <MenuPicker
                          menu={gathering.menu}
                          selectedIds={member.menuItemIds}
                          currency={gathering.currency}
                          onToggle={(itemId) => toggleMemberMenu(member.id, itemId)}
                          emptyLabel={t('organizerNoMenu')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setMembers((prev) => [...prev, createMemberDraft()])}
                >
                  {t('addMember')}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ margin: '1.25rem 0 0.35rem', fontFamily: 'var(--font-display)' }}>
                  {t('pickFromMenu')}
                </h3>
                <p className="sub">{t('pickMenuOrAlaCarte')}</p>
                <MenuPicker
                  menu={gathering.menu}
                  selectedIds={menuItemIds}
                  currency={gathering.currency}
                  onToggle={(itemId) =>
                    setMenuItemIds((prev) =>
                      toggleMenuSelection(prev, itemId, gathering.menu),
                    )
                  }
                  emptyLabel={t('organizerNoMenu')}
                />
              </>
            )}

            <div className="sticky-actions">
              <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                <div className="estimate-block">
                  <span className="estimate-label">
                    {hasAlaCartePick ? t('estimatedVariable') : t('estimated')}
                  </span>
                  <span className="estimate-value price">
                    {formatMoney(estimated, gathering.currency, localeTag)}
                    {hasAlaCartePick ? '+' : ''}
                  </span>
                  <span className="estimate-note">
                    {hasAlaCartePick ? t('estimatedNoteVariable') : t('estimatedNote')}
                    {asGroup
                      ? ` · ${members.length} ${
                          members.length === 1 ? t('personLabel') : t('peopleLabel')
                        }`
                      : ''}
                  </span>
                </div>
                <button className="btn btn-accent" type="submit" disabled={saving}>
                  {saving ? t('saving') : t('confirmRsvp')}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="panel guest-list-mobile-secondary">
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
                  {a.isGroup && a.members?.length ? (
                    <ul className="member-picks">
                      {a.members.map((m) => (
                        <li key={m.id}>
                          <strong>{m.name}</strong>
                          {' · '}
                          {menuLabel(m.menuItemIds, gathering.menu, t('noSelection'))}
                          {m.allergies ? (
                            <>
                              {' · '}
                              <span className="allergy">{m.allergies}</span>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
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
                  )}
                  {a.isGroup && (
                    <p className="sub" style={{ marginTop: '0.35rem' }}>
                      {formatMoney(attendeeTotal(a, gathering.menu), gathering.currency, localeTag)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
