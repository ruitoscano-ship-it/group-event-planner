import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { AgeGroupPicker } from '../components/AgeGroupPicker'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MenuOrderField } from '../components/MenuOrderField'
import { MenuPicker } from '../components/MenuPicker'
import { MenuSheet } from '../components/MenuSheet'
import { useI18n } from '../i18n/I18nContext'
import {
  createMemberDraft,
  formatDate,
  formatMoney,
  idsHaveAlaCarte,
  personOrderLabel,
  partySize,
  toggleMenuSelection,
  unitPriceForIds,
} from '../lib/money'
import { pickFeedback, rsvpSuccessKeys } from '../lib/feedback'
import {
  loadMyRsvp,
  saveMyRsvp,
} from '../lib/organizerAccess'
import { safeMediaUrl } from '../lib/safeUrl'
import {
  clearRsvpDraft,
  loadGuestPrefs,
  loadRsvpDraft,
  saveGuestPrefs,
  saveRsvpDraft,
} from '../lib/rsvpDraft'
import { useGatherings } from '../store/GatheringsContext'
import type { AgeGroup, GroupMember } from '../types'

type Step = 'who' | 'menu' | 'review'

const STEPS: Step[] = ['who', 'menu', 'review']

export function RsvpPage() {
  const { eventId = '' } = useParams()
  const { t, localeTag } = useI18n()
  const { getGathering, ensureGathering, addAttendee, sendMessage } =
    useGatherings()
  const gathering = getGathering(eventId)
  const formTopRef = useRef<HTMLElement | null>(null)

  const prefs = useMemo(() => loadGuestPrefs(), [])
  const draft = useMemo(
    () => (eventId ? loadRsvpDraft(eventId) : null),
    [eventId],
  )

  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('who')
  const [name, setName] = useState(draft?.name ?? '')
  const [registeredBy, setRegisteredBy] = useState(draft?.registeredBy ?? '')
  const [forSomeoneElse, setForSomeoneElse] = useState(draft?.forSomeoneElse ?? false)
  const [asGroup, setAsGroup] = useState(draft?.asGroup ?? false)
  const [members, setMembers] = useState<GroupMember[]>(() =>
    draft?.members?.length
      ? draft.members.map((m) => ({
          ...createMemberDraft(),
          ...m,
          carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
        }))
      : [createMemberDraft(), createMemberDraft()],
  )
  const [menuItemIds, setMenuItemIds] = useState<string[]>(draft?.menuItemIds ?? [])
  const [carteItemIds, setCarteItemIds] = useState<string[]>(
    draft?.carteItemIds ?? [],
  )
  const [allergies, setAllergies] = useState(draft?.allergies ?? '')
  const [email, setEmail] = useState(draft?.email ?? prefs.email ?? '')
  const [phone, setPhone] = useState(draft?.phone ?? prefs.phone ?? '')
  const [notes, setNotes] = useState(draft?.notes ?? '')
  const [menuRequest, setMenuRequest] = useState(draft?.menuRequest ?? '')
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(draft?.ageGroup ?? 'adult')
  const [submitted, setSubmitted] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [rsvpUpdated, setRsvpUpdated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    fromName: prefs.name || '',
    fromEmail: prefs.email || '',
    fromPhone: prefs.phone || '',
    body: '',
  })
  const [contactBusy, setContactBusy] = useState(false)
  const [contactMsg, setContactMsg] = useState<string | null>(null)
  const [contactError, setContactError] = useState(false)

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

  useEffect(() => {
    if (!eventId || submitted) return
    saveRsvpDraft(eventId, {
      name,
      registeredBy,
      forSomeoneElse,
      asGroup,
      members,
      menuItemIds,
      carteItemIds,
      allergies,
      email,
      phone,
      notes,
      menuRequest,
      ageGroup,
    })
  }, [
    eventId,
    submitted,
    name,
    registeredBy,
    forSomeoneElse,
    asGroup,
    members,
    menuItemIds,
    carteItemIds,
    allergies,
    email,
    phone,
    notes,
    menuRequest,
    ageGroup,
  ])

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

  const whoReady =
    name.trim().length > 0 &&
    (!forSomeoneElse || registeredBy.trim().length > 0)

  const hasMenuLoaded = Boolean(
    gathering &&
      (gathering.menu.length > 0 ||
        gathering.menuCardUrl ||
        (gathering.carteApproved && (gathering.carteItems || []).length > 0)),
  )

  const menuReady = useMemo(() => {
    if (!gathering) return false
    const needsPick = hasMenuLoaded
    if (asGroup) {
      if (members.length === 0) return false
      return members.every((m) => {
        if (!m.name.trim()) return false
        if (!needsPick) return true
        return (
          m.menuItemIds.length > 0 ||
          (m.carteItemIds || []).length > 0 ||
          Boolean(m.menuRequest.trim())
        )
      })
    }
    if (!needsPick) return true
    return (
      menuItemIds.length > 0 ||
      carteItemIds.length > 0 ||
      Boolean(menuRequest.trim())
    )
  }, [
    gathering,
    hasMenuLoaded,
    asGroup,
    members,
    menuItemIds,
    carteItemIds,
    menuRequest,
  ])

  function goTo(next: Step) {
    setSubmitError(null)
    setStep(next)
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetForm(keepContact = true) {
    setName('')
    setRegisteredBy('')
    setForSomeoneElse(false)
    setAsGroup(false)
    setMembers([createMemberDraft(), createMemberDraft()])
    setMenuItemIds([])
    setCarteItemIds([])
    setAllergies('')
    if (!keepContact) {
      setEmail('')
      setPhone('')
    }
    setNotes('')
    setMenuRequest('')
    setAgeGroup('adult')
    setStep('who')
    setSubmitError(null)
  }

  if (fetching) {
    return (
      <div className="rsvp-shell">
        <div className="empty rsvp-loading">{t('loadingRsvp')}</div>
      </div>
    )
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

  const stepIndex = STEPS.indexOf(step)
  const comingCount = gathering.attendees.reduce((sum, a) => sum + partySize(a), 0)

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

  async function onConfirm() {
    if (!gathering || !name.trim() || saving) return
    const registrar = forSomeoneElse
      ? registeredBy.trim() || 'Someone'
      : name.trim()

    if (!whoReady) {
      setSubmitError(t('rsvpNeedWho'))
      goTo('who')
      return
    }
    if (!menuReady) {
      setSubmitError(t('rsvpNeedMenu'))
      goTo('menu')
      return
    }

    setSaving(true)
    setSubmitError(null)
    try {
      const mine = loadMyRsvp(gathering.id)
      const result = await addAttendee(
        gathering.id,
        {
          name: name.trim(),
          registeredBy: registrar,
          email: email.trim(),
          phone: phone.trim(),
          menuItemIds: asGroup ? [] : menuItemIds,
          carteItemIds: asGroup ? [] : carteItemIds,
          allergies: asGroup ? '' : allergies.trim(),
          notes: notes.trim(),
          menuRequest: asGroup ? '' : menuRequest.trim(),
          ageGroup: asGroup ? 'adult' : ageGroup,
          isGroup: asGroup,
          groupSize: asGroup ? members.length : 1,
          guestKey: mine?.guestKey,
          members: asGroup
            ? members.map((m) => ({
                ...m,
                name: m.name.trim(),
                allergies: m.allergies.trim(),
                menuRequest: m.menuRequest.trim(),
                carteItemIds: m.carteItemIds || [],
                ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
              }))
            : [],
        },
        { asGuest: true },
      )

      const summary = asGroup
        ? `${name.trim()} · ${members.length} ${
            members.length === 1 ? t('personLabel') : t('peopleLabel')
          }`
        : `${name.trim()}${
            hasMenuLoaded
              ? ` · ${personOrderLabel(
                  menuItemIds,
                  carteItemIds,
                  menuRequest,
                  gathering,
                  t('noSelection'),
                )}`
              : ` · ${t('pickAlaCarteOnVenue')}`
          }`

      saveGuestPrefs({
        name: forSomeoneElse ? registeredBy.trim() : name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      })
      saveMyRsvp(
        gathering.id,
        result.attendeeId,
        email.trim(),
        result.guestKey || mine?.guestKey,
      )
      clearRsvpDraft(gathering.id)
      setLastSummary(summary)
      setRsvpUpdated(result.updated)
      setSuccessMessage(
        result.updated
          ? t('rsvpUpdatedMsg')
          : pickFeedback(t, [...rsvpSuccessKeys]),
      )
      setSubmitted(true)
      resetForm(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('rsvpSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function onContact(e: FormEvent) {
    e.preventDefault()
    if (!gathering || contactBusy) return
    if (!contactForm.fromName.trim() || !contactForm.body.trim()) {
      setContactError(true)
      setContactMsg(t('contactRequired'))
      return
    }
    setContactBusy(true)
    setContactMsg(null)
    setContactError(false)
    try {
      await sendMessage(gathering.id, {
        fromName: contactForm.fromName.trim(),
        fromEmail: contactForm.fromEmail.trim(),
        fromPhone: contactForm.fromPhone.trim(),
        body: contactForm.body.trim(),
      })
      setContactMsg(t('contactSent'))
      setContactForm((prev) => ({ ...prev, body: '' }))
    } catch (err) {
      setContactError(true)
      setContactMsg(err instanceof Error ? err.message : t('contactFailed'))
    } finally {
      setContactBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="rsvp-shell">
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
          <div className="event-summary-meta">
            <p>
              <span className="event-summary-label">{t('date')}</span>
              {formatDate(gathering.date, localeTag, t('dateTbd'))}
              {gathering.type ? ` · ${typeLabel}` : ''}
            </p>
            <p>
              <span className="event-summary-label">{t('time')}</span>
              {gathering.time || '—'}
            </p>
            <p>
              <span className="event-summary-label">{t('location')}</span>
              {gathering.location || t('locationTbd')}
            </p>
          </div>
        </div>

        <section className="panel rsvp-success-panel" role="status">
          <p className="rsvp-success-kicker">{t('rsvpDoneKicker')}</p>
          <h1>{successMessage || t('feedbackRsvp1')}</h1>
          {lastSummary && <p className="rsvp-success-summary">{lastSummary}</p>}
          <p className="sub">
            {rsvpUpdated ? t('rsvpDoneUpdatedSub') : t('rsvpDoneSub')}
          </p>
          <div className="form-actions rsvp-success-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => {
                const mine = loadMyRsvp(gathering.id)
                setSubmitted(false)
                setLastSummary(null)
                setRsvpUpdated(false)
                setStep('who')
                if (mine?.email) setEmail(mine.email)
                formTopRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {t('rsvpUpdateMine')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setContactOpen(true)}
            >
              {t('contactOrganizer')}
            </button>
          </div>
        </section>

        {contactOpen && (
          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2>{t('contactOrganizer')}</h2>
            <p className="sub">{t('contactOrganizerSub')}</p>
            {contactMsg && (
              <div
                className={`feedback-banner ${contactError ? 'error' : ''}`}
                role="status"
              >
                {contactMsg}
              </div>
            )}
            <form onSubmit={(e) => void onContact(e)}>
              <div className="form-grid">
                <label className="full">
                  {t('yourName')}
                  <input
                    required
                    value={contactForm.fromName}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, fromName: e.target.value })
                    }
                    autoComplete="name"
                  />
                </label>
                <label className="full">
                  {t('contactMessage')}
                  <textarea
                    required
                    value={contactForm.body}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, body: e.target.value })
                    }
                    placeholder={t('contactMessagePlaceholder')}
                    rows={3}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="btn btn-accent" type="submit" disabled={contactBusy}>
                  {contactBusy ? t('saving') : t('sendMessage')}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="rsvp-shell">
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
        <div className="event-summary-meta">
          <p>
            <span className="event-summary-label">{t('date')}</span>
            {formatDate(gathering.date, localeTag, t('dateTbd'))}
            {gathering.type ? ` · ${typeLabel}` : ''}
          </p>
          <p>
            <span className="event-summary-label">{t('time')}</span>
            {gathering.time || '—'}
          </p>
          <p>
            <span className="event-summary-label">{t('location')}</span>
            {gathering.location || t('locationTbd')}
          </p>
        </div>
        {comingCount > 0 && (
          <p className="rsvp-coming-line">
            {t('alreadyComing', { count: comingCount })}
          </p>
        )}
      </div>

      <section className="panel rsvp-flow" ref={formTopRef}>
        <p className="rsvp-unique-hint">{t('rsvpUniqueHint')}</p>
        <nav className="rsvp-steps" aria-label={t('rsvpStepsLabel')}>
          {STEPS.map((key, index) => {
            const active = step === key
            const done = index < stepIndex
            return (
              <button
                key={key}
                type="button"
                className={`rsvp-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => {
                  if (done || active) goTo(key)
                }}
                disabled={!done && !active}
              >
                <span className="rsvp-step-num">{index + 1}</span>
                <span>
                  {key === 'who'
                    ? t('rsvpStepWho')
                    : key === 'menu'
                      ? t('rsvpStepMenu')
                      : t('rsvpStepReview')}
                </span>
              </button>
            )
          })}
        </nav>

        {submitError && (
          <div className="feedback-banner error" role="alert">
            {submitError}
          </div>
        )}

        {step === 'who' && (
          <div className="rsvp-step-body">
            <h2>{t('rsvpStepWhoTitle')}</h2>
            <p className="sub">{t('rsvpStepWhoSub')}</p>
            <div className="form-grid">
              <label className="full">
                {asGroup ? t('groupName') : t('guestName')}
                <input
                  required
                  autoComplete="name"
                  autoFocus
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
                  <div className="full">
                    <AgeGroupPicker value={ageGroup} onChange={setAgeGroup} />
                  </div>
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
                  rows={2}
                />
              </label>
            </div>
          </div>
        )}

        {step === 'menu' && (
          <div className="rsvp-step-body">
            <h2>{t('rsvpStepMenuTitle')}</h2>
            <p className="sub">
              {hasMenuLoaded ? t('rsvpStepMenuSub') : t('pickAlaCarteOnVenueSub')}
            </p>

            {!hasMenuLoaded ? (
              <div className="rsvp-venue-pick" role="status">
                <p className="rsvp-venue-pick-title">{t('pickAlaCarteOnVenue')}</p>
                <p className="sub">{t('pickAlaCarteOnVenueSub')}</p>
                {asGroup && (
                  <>
                    <div className="member-list" style={{ marginTop: '1rem' }}>
                      {members.map((member, index) => (
                        <div key={member.id} className="member-card">
                          <div className="member-card-head">
                            <h4>{t('memberLabel', { n: index + 1 })}</h4>
                            {members.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() =>
                                  setMembers((prev) =>
                                    prev.filter((m) => m.id !== member.id),
                                  )
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
                              onChange={(e) =>
                                updateMember(member.id, { name: e.target.value })
                              }
                              placeholder={t('memberNamePlaceholder')}
                              autoComplete="name"
                            />
                          </label>
                          <AgeGroupPicker
                            value={member.ageGroup || 'adult'}
                            onChange={(value) =>
                              updateMember(member.id, { ageGroup: value })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setMembers((prev) => [...prev, createMemberDraft()])
                      }
                    >
                      {t('addMember')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
            {(gathering.menuCardUrl ||
              gathering.menu.length > 0 ||
              (gathering.carteApproved && (gathering.carteItems || []).length > 0)) && (
              <div className="menu-peek-bar">
                <p className="sub">{t('menuPeekHint')}</p>
                <MenuSheet gathering={gathering} />
              </div>
            )}

            {safeMediaUrl(gathering.menuCardUrl) && (
              <details className="collapsible-details">
                <summary>{t('viewMenuCard')}</summary>
                <div className="menu-card-preview">
                  <img src={safeMediaUrl(gathering.menuCardUrl)} alt={t('menuCard')} />
                </div>
              </details>
            )}

            {asGroup ? (
              <>
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
                      <AgeGroupPicker
                        value={member.ageGroup || 'adult'}
                        onChange={(value) => updateMember(member.id, { ageGroup: value })}
                      />
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
                      {gathering.menu.length > 0 && (
                        <div>
                          <p className="sub" style={{ marginBottom: '0.5rem' }}>
                            {t('memberMenu')}
                          </p>
                          <MenuPicker
                            menu={gathering.menu}
                            selectedIds={member.menuItemIds}
                            currency={gathering.currency}
                            onToggle={(itemId) => toggleMemberMenu(member.id, itemId)}
                            emptyLabel={t('organizerNoMenu')}
                          />
                        </div>
                      )}
                      {(gathering.menuCardUrl ||
                        (gathering.carteApproved &&
                          (gathering.carteItems || []).length > 0)) && (
                        <MenuOrderField
                          carteItems={gathering.carteItems || []}
                          carteApproved={Boolean(gathering.carteApproved)}
                          selectedCarteIds={member.carteItemIds || []}
                          onCarteChange={(ids) =>
                            updateMember(member.id, { carteItemIds: ids })
                          }
                          menuRequest={member.menuRequest}
                          onMenuRequestChange={(value) =>
                            updateMember(member.id, { menuRequest: value })
                          }
                          placeholder={t('menuRequestPlaceholder')}
                        />
                      )}
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
                {gathering.menu.length > 0 && (
                  <>
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
                {(gathering.menuCardUrl ||
                  (gathering.carteApproved &&
                    (gathering.carteItems || []).length > 0)) && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <MenuOrderField
                      carteItems={gathering.carteItems || []}
                      carteApproved={Boolean(gathering.carteApproved)}
                      selectedCarteIds={carteItemIds}
                      onCarteChange={setCarteItemIds}
                      menuRequest={menuRequest}
                      onMenuRequestChange={setMenuRequest}
                      placeholder={t('menuRequestPlaceholder')}
                    />
                  </div>
                )}
              </>
            )}
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="rsvp-step-body">
            <h2>{t('rsvpStepReviewTitle')}</h2>
            <p className="sub">{t('rsvpStepReviewSub')}</p>
            <div className="rsvp-review-card">
              <div className="rsvp-review-row">
                <span>{asGroup ? t('groupName') : t('guestName')}</span>
                <strong>{name.trim() || '—'}</strong>
              </div>
              {!asGroup && (
                <div className="rsvp-review-row">
                  <span>{t('ageGroup')}</span>
                  <strong>
                    {ageGroup === 'child' ? t('ageChild') : t('ageAdult')}
                  </strong>
                </div>
              )}
              {(email || phone) && (
                <div className="rsvp-review-row">
                  <span>{t('rsvpContact')}</span>
                  <strong>{[email, phone].filter(Boolean).join(' · ')}</strong>
                </div>
              )}
              {asGroup ? (
                <ul className="member-picks">
                  {members.map((m) => (
                    <li key={m.id}>
                      <strong>{m.name || '—'}</strong>
                      {hasMenuLoaded && (
                        <>
                          {' · '}
                          {personOrderLabel(
                            m.menuItemIds,
                            m.carteItemIds || [],
                            m.menuRequest || '',
                            gathering,
                            t('pickAlaCarteOnVenue'),
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rsvp-review-row">
                  <span>{t('pickFromMenu')}</span>
                  <strong>
                    {hasMenuLoaded
                      ? personOrderLabel(
                          menuItemIds,
                          carteItemIds,
                          menuRequest,
                          gathering,
                          t('noSelection'),
                        )
                      : t('pickAlaCarteOnVenue')}
                  </strong>
                </div>
              )}
              {allergies && !asGroup && (
                <div className="rsvp-review-row">
                  <span>{t('allergiesDietary')}</span>
                  <strong>{allergies}</strong>
                </div>
              )}
              <div className="rsvp-review-row highlight">
                <span>
                  {hasMenuLoaded
                    ? hasAlaCartePick
                      ? t('estimatedVariable')
                      : t('estimated')
                    : t('pickFromMenu')}
                </span>
                <strong className={hasMenuLoaded ? 'price' : undefined}>
                  {hasMenuLoaded
                    ? `${formatMoney(estimated, gathering.currency, localeTag)}${
                        hasAlaCartePick ? '+' : ''
                      }`
                    : t('pickAlaCarteOnVenue')}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="sticky-actions rsvp-sticky">
          <div className="form-actions rsvp-nav-actions">
            {step !== 'who' ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  goTo(STEPS[Math.max(0, stepIndex - 1)] ?? 'who')
                }
              >
                {t('rsvpBack')}
              </button>
            ) : (
              <span />
            )}

            {step === 'who' && (
              <button
                type="button"
                className="btn btn-accent"
                disabled={!whoReady}
                onClick={() => goTo('menu')}
              >
                {t('rsvpContinue')}
              </button>
            )}
            {step === 'menu' && (
              <button
                type="button"
                className="btn btn-accent"
                disabled={!menuReady}
                onClick={() => goTo('review')}
              >
                {t('rsvpContinue')}
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                className="btn btn-accent"
                disabled={saving}
                onClick={() => void onConfirm()}
              >
                {saving ? t('saving') : t('confirmRsvp')}
              </button>
            )}
          </div>
          {(step === 'menu' || step === 'review') && (
            <p className="rsvp-sticky-estimate">
              {hasMenuLoaded ? (
                <>
                  {t('estimated')}{' '}
                  <strong className="price">
                    {formatMoney(estimated, gathering.currency, localeTag)}
                    {hasAlaCartePick ? '+' : ''}
                  </strong>
                  {step === 'menu' && (
                    <>
                      {' · '}
                      <MenuSheet gathering={gathering} compact />
                    </>
                  )}
                </>
              ) : (
                <strong>{t('pickAlaCarteOnVenue')}</strong>
              )}
            </p>
          )}
        </div>
      </section>

      <details className="panel rsvp-secondary" style={{ marginTop: '1rem' }}>
        <summary>
          {t('alreadyComing', { count: comingCount })}
        </summary>
        <p className="sub">{t('alreadyComingSub')}</p>
        {gathering.attendees.length === 0 ? (
          <div className="empty">{t('beFirst')}</div>
        ) : (
          <ul className="rsvp-coming-names">
            {gathering.attendees.map((a) => (
              <li key={a.id}>
                <strong>{a.name}</strong>
                {a.isGroup && a.members?.length
                  ? ` · ${a.members
                      .map((m) => m.name)
                      .filter(Boolean)
                      .join(', ')}`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details
        className="panel rsvp-secondary"
        style={{ marginTop: '0.75rem' }}
        open={contactOpen}
        onToggle={(e) => setContactOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{t('contactOrganizer')}</summary>
        <p className="sub">{t('contactOrganizerSub')}</p>
        {contactMsg && (
          <div
            className={`feedback-banner ${contactError ? 'error' : ''}`}
            role="status"
          >
            {contactMsg}
          </div>
        )}
        <form onSubmit={(e) => void onContact(e)}>
          <div className="form-grid">
            <label className="full">
              {t('yourName')}
              <input
                required
                value={contactForm.fromName}
                onChange={(e) =>
                  setContactForm({ ...contactForm, fromName: e.target.value })
                }
                autoComplete="name"
              />
            </label>
            <label className="full">
              {t('contactMessage')}
              <textarea
                required
                value={contactForm.body}
                onChange={(e) =>
                  setContactForm({ ...contactForm, body: e.target.value })
                }
                placeholder={t('contactMessagePlaceholder')}
                rows={3}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={contactBusy}>
              {contactBusy ? t('saving') : t('sendMessage')}
            </button>
          </div>
        </form>
      </details>
    </div>
  )
}
