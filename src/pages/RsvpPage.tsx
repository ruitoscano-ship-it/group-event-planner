import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { AgeGroupPicker } from '../components/AgeGroupPicker'
import { GroupSizeStepper } from '../components/GroupSizeStepper'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MenuOrderField } from '../components/MenuOrderField'
import { MenuPicker } from '../components/MenuPicker'
import { MenuSheet } from '../components/MenuSheet'
import { PartyKindPicker, type PartyKind } from '../components/PartyKindPicker'
import { PaymentInstructionsView } from '../components/PaymentInstructionsView'
import { useI18n } from '../i18n/I18nContext'
import { api } from '../lib/api'
import {
  createMemberDraft,
  formatDate,
  formatMoney,
  idsHaveAlaCarte,
  personOrderLabel,
  partySize,
  resizeMembers,
  toggleMenuSelection,
  unitPriceForIds,
} from '../lib/money'
import { pickFeedback, rsvpSuccessKeys } from '../lib/feedback'
import {
  clearMyRsvp,
  loadMyRsvp,
  saveMyRsvp,
} from '../lib/organizerAccess'
import { hasPaymentInstructions } from '../lib/paymentInfo'
import { isRsvpOpen } from '../lib/rsvpStatus'
import { safeMediaUrl } from '../lib/safeUrl'
import {
  clearRsvpDraft,
  loadGuestPrefs,
  loadRsvpDraft,
  saveGuestPrefs,
  saveRsvpDraft,
} from '../lib/rsvpDraft'
import { useGatherings } from '../store/GatheringsContext'
import type { AgeGroup, Attendee, GroupMember } from '../types'

type Step = 'who' | 'menu' | 'review'

export function RsvpPage() {
  const { eventId = '' } = useParams()
  const { t, localeTag } = useI18n()
  const { getGathering, ensureGathering, addAttendee, sendMessage, removeAttendee, updateAttendee } =
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
  const [partyKind, setPartyKind] = useState<PartyKind | null>(() => {
    if (draft?.asGroup) return 'group'
    if (draft?.name) return 'individual'
    return null
  })
  const asGroup = partyKind === 'group'
  const [members, setMembers] = useState<GroupMember[]>(() =>
    draft?.members?.length
      ? draft.members.map((m) => ({
          ...createMemberDraft(),
          ...m,
          carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
        }))
      : resizeMembers([], 2),
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
  const [statusBanner, setStatusBanner] = useState<string | null>(null)
  const [statusReady, setStatusReady] = useState(false)
  const restoreAttempted = useRef(false)
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [rsvpUpdated, setRsvpUpdated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [claimBusy, setClaimBusy] = useState(false)
  const [paymentClaimed, setPaymentClaimed] = useState(false)
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

  function applyAttendeeToForm(attendee: Attendee) {
    const isGroup = Boolean(attendee.isGroup && attendee.members?.length)
    setPartyKind(isGroup ? 'group' : 'individual')
    setName(attendee.name || '')
    setRegisteredBy(attendee.registeredBy || '')
    setForSomeoneElse(
      Boolean(attendee.registeredBy && attendee.registeredBy !== attendee.name),
    )
    setEmail(attendee.email || '')
    setPhone(attendee.phone || '')
    setNotes(attendee.notes || '')
    setAllergies(attendee.allergies || '')
    setMenuRequest(attendee.menuRequest || '')
    setAgeGroup(attendee.ageGroup === 'child' ? 'child' : 'adult')
    setMenuItemIds(attendee.menuItemIds || [])
    setCarteItemIds(attendee.carteItemIds || [])
    if (isGroup) {
      setMembers(
        (attendee.members || []).map((m) => ({
          ...createMemberDraft(),
          ...m,
          carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
        })),
      )
    }
    setPaymentClaimed(Boolean(attendee.paymentClaimedAt))
    setLastSummary(attendee.name || null)
  }

  useEffect(() => {
    if (!gathering || restoreAttempted.current) return
    const mine = loadMyRsvp(gathering.id)
    if (!mine?.guestKey) {
      setStatusReady(true)
      return
    }
    restoreAttempted.current = true
    void api
      .getMyAttendee(gathering.id, mine.guestKey)
      .then(({ attendee }) => {
        applyAttendeeToForm(attendee)
        saveMyRsvp(gathering.id, attendee.id, attendee.email || mine.email, mine.guestKey)
        setSuccessMessage(t('statusYourRsvp'))
        setSubmitted(true)
      })
      .catch(() => {
        // Stale local key — stay on wizard
      })
      .finally(() => setStatusReady(true))
  }, [gathering, t])

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
    partyKind === 'individual'
      ? name.trim().length > 0 && (!forSomeoneElse || registeredBy.trim().length > 0)
      : partyKind === 'group'
        ? members.length >= 2 &&
          members.every((m) => m.name.trim().length > 0) &&
          (!forSomeoneElse || registeredBy.trim().length > 0)
        : false

  function ensureGroupName(): string {
    const trimmed = name.trim()
    if (trimmed) return trimmed
    const first = members.find((m) => m.name.trim())?.name.trim()
    return first || t('groupNamePlaceholder')
  }

  function choosePartyKind(next: PartyKind) {
    setPartyKind(next)
    if (next === 'group') {
      setMembers((prev) => (prev.length >= 2 ? prev : resizeMembers(prev, 2)))
    }
  }

  function setGroupSize(size: number) {
    setMembers((prev) => resizeMembers(prev, size))
  }

  const hasMenuLoaded = Boolean(
    gathering &&
      (gathering.menu.length > 0 ||
        gathering.menuCardUrl ||
        (gathering.carteApproved && (gathering.carteItems || []).length > 0)),
  )

  const steps: Step[] = hasMenuLoaded ? ['who', 'menu', 'review'] : ['who', 'review']

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
    setPartyKind(null)
    setMembers(resizeMembers([], 2))
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

  if (fetching || (gathering && !statusReady && loadMyRsvp(gathering.id)?.guestKey)) {
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

  const stepIndex = steps.indexOf(step)
  const comingCount = gathering.attendees.reduce((sum, a) => sum + partySize(a), 0)
  const myRsvp = loadMyRsvp(gathering.id)
  const guestCanUpdate = Boolean(myRsvp?.attendeeId && myRsvp.guestKey)
  const rsvpOpen = isRsvpOpen(gathering) || guestCanUpdate

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
    if (!gathering || saving) return
    const displayName = asGroup ? ensureGroupName() : name.trim()
    if (!displayName) return
    const registrar = forSomeoneElse
      ? registeredBy.trim() || 'Someone'
      : displayName

    if (!whoReady) {
      setSubmitError(
        partyKind == null
          ? t('rsvpNeedPartyKind')
          : asGroup
            ? t('rsvpNeedGroupPeople')
            : t('rsvpNeedWho'),
      )
      goTo('who')
      return
    }
    if (!menuReady) {
      setSubmitError(t('rsvpNeedMenu'))
      goTo(hasMenuLoaded ? 'menu' : 'review')
      return
    }

    setSaving(true)
    setSubmitError(null)
    try {
      const mine = loadMyRsvp(gathering.id)
      const result = await addAttendee(
        gathering.id,
        {
          name: displayName,
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
        ? `${displayName} · ${members.length} ${
            members.length === 1 ? t('personLabel') : t('peopleLabel')
          }`
        : `${displayName}${
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
        name: forSomeoneElse ? registeredBy.trim() : displayName,
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
          <h1>{successMessage || t('statusYourRsvp')}</h1>
          {lastSummary && <p className="rsvp-success-summary">{lastSummary}</p>}
          <p className="sub">
            {rsvpUpdated ? t('rsvpDoneUpdatedSub') : t('rsvpDoneSub')}
          </p>
          {hasPaymentInstructions(gathering) && (
            <>
              <PaymentInstructionsView gathering={gathering} />
              <div className="form-actions rsvp-success-actions">
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={claimBusy || paymentClaimed || !loadMyRsvp(gathering.id)?.guestKey}
                  onClick={() => {
                    const mine = loadMyRsvp(gathering.id)
                    if (!mine?.attendeeId || !mine.guestKey) return
                    setClaimBusy(true)
                    void updateAttendee(
                      gathering.id,
                      mine.attendeeId,
                      { paymentClaimed: true },
                      { guestKey: mine.guestKey },
                    )
                      .then(() => setPaymentClaimed(true))
                      .catch((err) => {
                        setSubmitError(
                          err instanceof Error ? err.message : t('contactFailed'),
                        )
                      })
                      .finally(() => setClaimBusy(false))
                  }}
                >
                  {paymentClaimed
                    ? t('paymentClaimSentDone')
                    : claimBusy
                      ? t('saving')
                      : t('paymentClaimSent')}
                </button>
              </div>
            </>
          )}
          <div className="form-actions rsvp-success-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => {
                setSubmitted(false)
                setRsvpUpdated(false)
                setStep('who')
                formTopRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {t('statusEditRsvp')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={cancelBusy || !loadMyRsvp(gathering.id)?.guestKey}
              hidden={!loadMyRsvp(gathering.id)?.guestKey}
              onClick={() => {
                const mine = loadMyRsvp(gathering.id)
                if (!mine?.attendeeId || !mine.guestKey) return
                if (!window.confirm(t('cancelMyRsvpConfirm'))) return
                setCancelBusy(true)
                void removeAttendee(gathering.id, mine.attendeeId, {
                  guestKey: mine.guestKey,
                })
                  .then(() => {
                    clearMyRsvp(gathering.id)
                    clearRsvpDraft(gathering.id)
                    setSubmitted(false)
                    setLastSummary(null)
                    setStatusBanner(t('cancelBanner'))
                    setSuccessMessage('')
                    resetForm(true)
                    restoreAttempted.current = true
                    setStatusReady(true)
                  })
                  .catch((err) => {
                    setSubmitError(
                      err instanceof Error ? err.message : t('contactFailed'),
                    )
                  })
                  .finally(() => setCancelBusy(false))
              }}
            >
              {cancelBusy ? t('saving') : t('cancelMyRsvp')}
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
                <label>
                  {t('emailOptional')}
                  <input
                    type="email"
                    value={contactForm.fromEmail}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, fromEmail: e.target.value })
                    }
                    autoComplete="email"
                  />
                </label>
                <label>
                  {t('phoneOptional')}
                  <input
                    type="tel"
                    value={contactForm.fromPhone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, fromPhone: e.target.value })
                    }
                    autoComplete="tel"
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

  if (!rsvpOpen) {
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
        <section className="panel">
          <h2>{gathering.title}</h2>
          <p className="sub">{t('rsvpClosedGuest')}</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setContactOpen(true)}
            >
              {t('rsvpClosedGuestContact')}
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

      {statusBanner && (
        <div className="feedback-banner" role="status" style={{ marginBottom: '1rem' }}>
          {statusBanner}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setStatusBanner(null)}
          >
            {t('dismiss')}
          </button>
        </div>
      )}

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
          {steps.map((key, index) => {
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

            <PartyKindPicker value={partyKind} onChange={choosePartyKind} />

            {partyKind === 'individual' && (
              <div className="form-grid rsvp-party-fields">
                <label className="full">
                  {t('guestName')}
                  <input
                    required
                    autoComplete="name"
                    autoFocus
                    enterKeyHint="next"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                  />
                </label>
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
              </div>
            )}

            {partyKind === 'group' && (
              <div className="rsvp-party-fields">
                <GroupSizeStepper value={members.length} onChange={setGroupSize} />
                <div className="group-people">
                  <h3>{t('groupPeopleTitle')}</h3>
                  <p className="sub">{t('groupPeopleSub')}</p>
                  <div className="group-people-list">
                    {members.map((member, index) => (
                      <div key={member.id} className="group-people-row">
                        <span className="group-people-index" aria-hidden>
                          {index + 1}
                        </span>
                        <label>
                          <span className="sr-only">
                            {t('memberLabel', { n: index + 1 })}
                          </span>
                          <input
                            required
                            value={member.name}
                            onChange={(e) =>
                              updateMember(member.id, { name: e.target.value })
                            }
                            placeholder={t('memberNamePlaceholder')}
                            autoComplete="name"
                            autoFocus={index === 0}
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
                </div>
                <label className="full">
                  {t('groupNameOptional')}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('groupNamePlaceholder')}
                  />
                  <span className="field-hint">{t('groupNameAutoHint')}</span>
                </label>
              </div>
            )}

            {partyKind && (
              <div className="rsvp-optional-block">
                <h3>{t('optionalContactDetails')}</h3>
                <p className="sub">{t('optionalContactDetailsSub')}</p>
                <div className="form-grid">
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
                  <ul className="group-people-summary">
                    {members.map((member) => (
                      <li key={member.id}>{member.name.trim() || '—'}</li>
                    ))}
                  </ul>
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
              <div className="member-list">
                {members.map((member, index) => (
                  <div key={member.id} className="member-card">
                    <div className="member-card-head">
                      <h4>
                        {member.name.trim() || t('memberLabel', { n: index + 1 })}
                      </h4>
                    </div>
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
                  goTo(steps[Math.max(0, stepIndex - 1)] ?? 'who')
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
                onClick={() => goTo(hasMenuLoaded ? 'menu' : 'review')}
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


    </div>
  )
}
