import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AgeGroupPicker } from '../components/AgeGroupPicker'
import { EventCarteEditor } from '../components/EventCarteEditor'
import { FirstEventCoach, type CoachStep } from '../components/FirstEventCoach'
import { GuestEditor } from '../components/GuestEditor'
import { ImageUploadDropzone } from '../components/ImageUploadDropzone'
import { InviteCard } from '../components/InviteCard'
import { KitchenBoard } from '../components/KitchenBoard'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MenuPicker } from '../components/MenuPicker'
import { PaymentBoard } from '../components/PaymentBoard'
import { PaymentInstructionsView } from '../components/PaymentInstructionsView'
import { useI18n } from '../i18n/I18nContext'
import { buildGatheringIcs, downloadIcs } from '../lib/calendarIcs'
import {
  buildChangeOfPlanText,
  buildInviteShareText,
  nativeShare,
  rsvpQrImageUrl,
  whatsappShareUrl,
} from '../lib/inviteShare'
import {
  compressImageFile,
  formatDate,
  formatMoney,
  gatheringTotals,
  toggleMenuSelection,
} from '../lib/money'
import {
  formatOrganizerCode,
  loadOrganizerCode,
} from '../lib/organizerAccess'
import { hasPaymentInstructions } from '../lib/paymentInfo'
import {
  buildEventReportHtml,
  buildOrderSheetHtml,
  openEventReport,
} from '../lib/report'
import { isRsvpOpen } from '../lib/rsvpStatus'
import { safeMediaUrl } from '../lib/safeUrl'
import {
  detailsSavedKeys,
  guestAddedKeys,
  menuCardSavedKeys,
  menuItemSavedKeys,
  pickFeedback,
} from '../lib/feedback'
import {
  markAssistedComplete,
  resetAssistedMode,
} from '../lib/assistedMode'
import { useGatherings } from '../store/GatheringsContext'
import { useOrganizerAuth } from '../store/OrganizerAuthContext'
import type { AgeGroup } from '../types'

type Tab = 'guests' | 'payments' | 'kitchen' | 'inbox'
type Phase = 'setup' | 'invite' | 'run' | 'wrap'

const SHARE_DONE_KEY = 'round-share-done-v1'

function pickDefaultPhase(
  gathering: {
    date: string
    location: string
    menu: unknown[]
    attendees: unknown[]
  },
  justCreated: boolean,
  shareDone: boolean,
): Phase {
  if (justCreated) return 'setup'
  const setupIncomplete =
    !gathering.date || !gathering.location.trim() || gathering.menu.length === 0
  if (setupIncomplete) return 'setup'
  if (gathering.attendees.length > 0) return 'run'
  if (!shareDone) return 'invite'
  return 'run'
}

function loadShareDone(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(SHARE_DONE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return Boolean(parsed[eventId])
  } catch {
    return false
  }
}

function markShareDone(eventId: string) {
  try {
    const raw = localStorage.getItem(SHARE_DONE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    parsed[eventId] = true
    localStorage.setItem(SHARE_DONE_KEY, JSON.stringify(parsed))
  } catch {
    // ignore
  }
}

export function EventPage() {
  const { eventId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, locale, localeTag } = useI18n()
  const {
    getGathering,
    ensureGathering,
    loading,
    deleteGathering,
    updateGathering,
    addMenuItem,
    setMenuCard,
    removeMenuItem,
    addAttendee,
    updateAttendee,
    removeAttendee,
    markMessageRead,
    deleteMessage,
    setMenuCarte,
    unlockEvent,
    updateOrganizerCode,
    hasOrganizerAccess,
  } = useGatherings()
  const gathering = getGathering(eventId)
  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('guests')
  const [phase, setPhase] = useState<Phase | null>(null)
  const [codePanelOpen, setCodePanelOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showWalkUpQr, setShowWalkUpQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [editingCode, setEditingCode] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  const [codeError, setCodeError] = useState(false)
  const justCreated = searchParams.get('created') === '1'
  const [coachStep, setCoachStep] = useState<CoachStep | null>(null)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const shareBoxRef = useRef<HTMLElement | null>(null)
  const codePanelRef = useRef<HTMLDetailsElement | null>(null)
  const menuFocusRef = useRef<HTMLDivElement | null>(null)
  const { ownsGathering, user: authUser, refreshAuth } = useOrganizerAuth()
  const canManage = hasOrganizerAccess(eventId) || ownsGathering(eventId)
  const organizerCode = loadOrganizerCode(eventId)
  const [cardLink, setCardLink] = useState('')
  const [cardBusy, setCardBusy] = useState(false)
  const [cardMsg, setCardMsg] = useState<string | null>(null)
  const [detailsForm, setDetailsForm] = useState({
    title: '',
    notes: '',
    date: '',
    time: '',
    location: '',
    organizerName: '',
    organizerEmail: '',
    organizerPhone: '',
    paymentIban: '',
    paymentMbWay: '',
    paymentBizum: '',
    paymentNote: '',
    paymentQrUrl: '',
    rsvpDeadline: '',
    rsvpClosed: false,
  })
  const [detailsBusy, setDetailsBusy] = useState(false)
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [shareDone, setShareDone] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [changePlanText, setChangePlanText] = useState<string | null>(null)
  const [payFormBusy, setPayFormBusy] = useState(false)
  const [payFormMsg, setPayFormMsg] = useState<string | null>(null)
  const [menuMsg, setMenuMsg] = useState<string | null>(null)
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    exclusions: '',
    price: '',
    kind: 'set' as 'set' | 'alacarte',
  })
  const [guestForm, setGuestForm] = useState({
    name: '',
    asGroup: false,
    menuItemIds: [] as string[],
    carteItemIds: [] as string[],
    allergies: '',
    email: '',
    phone: '',
    notes: '',
    menuRequest: '',
    ageGroup: 'adult' as AgeGroup,
  })
  const [guestBusy, setGuestBusy] = useState(false)
  const [guestMsg, setGuestMsg] = useState<string | null>(null)
  const [guestError, setGuestError] = useState(false)
  const [reportMsg, setReportMsg] = useState<string | null>(null)

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
    if (gathering?.menuCardUrl && !gathering.menuCardUrl.startsWith('data:')) {
      const safe = safeMediaUrl(gathering.menuCardUrl)
      if (safe) setCardLink(safe)
    }
  }, [gathering?.menuCardUrl])

  useEffect(() => {
    if (!canManage || !coachStep) {
      delete document.body.dataset.demoOpen
      return
    }
    document.body.dataset.demoOpen = '1'
    return () => {
      delete document.body.dataset.demoOpen
    }
  }, [coachStep, canManage])

  useEffect(() => {
    if (!canManage || !coachStep) return

    let cancelled = false
    let attempts = 0

    function scrollToDemoTarget() {
      if (cancelled) return
      const target =
        coachStep === 'code'
          ? codePanelRef.current
          : coachStep === 'menu'
            ? menuFocusRef.current
            : coachStep === 'share' || coachStep === 'done'
              ? shareBoxRef.current
              : null

      if (!target) {
        if (attempts < 8) {
          attempts += 1
          window.setTimeout(scrollToDemoTarget, 50)
        }
        return
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }

    const timer = window.setTimeout(scrollToDemoTarget, 60)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [coachStep, canManage])

  useEffect(() => {
    if (!gathering) return
    setDetailsForm({
      title: gathering.title || '',
      notes: gathering.notes || '',
      date: gathering.date || '',
      time: gathering.time || '',
      location: gathering.location || '',
      organizerName: gathering.organizerName || '',
      organizerEmail: gathering.organizerEmail || '',
      organizerPhone: gathering.organizerPhone || '',
      paymentIban: gathering.paymentIban || '',
      paymentMbWay: gathering.paymentMbWay || '',
      paymentBizum: gathering.paymentBizum || '',
      paymentNote: gathering.paymentNote || '',
      paymentQrUrl: gathering.paymentQrUrl || '',
      rsvpDeadline: gathering.rsvpDeadline || '',
      rsvpClosed: Boolean(gathering.rsvpClosed),
    })
    setShareDone(loadShareDone(gathering.id))
    setPhase((prev) =>
      prev ??
      pickDefaultPhase(
        gathering,
        searchParams.get('created') === '1',
        loadShareDone(gathering.id),
      ),
    )
    if (searchParams.get('created') === '1') setCodePanelOpen(true)
  }, [
    gathering?.id,
    gathering?.title,
    gathering?.notes,
    gathering?.date,
    gathering?.time,
    gathering?.location,
    gathering?.organizerName,
    gathering?.organizerEmail,
    gathering?.organizerPhone,
    gathering?.paymentIban,
    gathering?.paymentMbWay,
    gathering?.paymentBizum,
    gathering?.paymentNote,
    gathering?.paymentQrUrl,
    gathering?.rsvpDeadline,
    gathering?.rsvpClosed,
    gathering?.menu,
    gathering?.attendees,
    searchParams,
  ])

  const totals = useMemo(
    () => (gathering ? gatheringTotals(gathering) : null),
    [gathering],
  )

  if (fetching || (loading && !gathering)) {
    return <div className="empty">{t('loadingGathering')}</div>
  }

  if (notFound || !gathering || !totals) {
    return (
      <div className="panel">
        <h2>{t('gatheringNotFound')}</h2>
        <p className="sub">{t('gatheringDeleted')}</p>
        <Link viewTransition className="btn btn-accent" to="/">
          {t('goHome')}
        </Link>
      </div>
    )
  }

  if (!canManage) {
    return (
      <>
        <header className="topbar">
          <Link viewTransition to="/" className="brand">
            <i className="brand-mark" aria-hidden />
            Round<span>.</span>
          </Link>
          <LanguageSwitcher />
        </header>
        <section className="panel unlock-panel">
          <h2>{t('unlockEventTitle')}</h2>
          <p className="sub">{t('unlockEventSub', { title: gathering.title })}</p>
          {authUser && (
            <p className="sub">{t('unlockClaimHint', { email: authUser.email })}</p>
          )}
          {unlockError && <p className="allergy">{unlockError}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!unlockCode.trim() || unlockBusy) return
              setUnlockBusy(true)
              setUnlockError(null)
              void unlockEvent(gathering.id, unlockCode.trim())
                .then(async () => {
                  setUnlockCode('')
                  setSearchParams({}, { replace: true })
                  await refreshAuth()
                })
                .catch((err) => {
                  setUnlockError(
                    err instanceof Error ? err.message : t('accessCodeFailed'),
                  )
                })
                .finally(() => setUnlockBusy(false))
            }}
          >
            <label className="full">
              {t('organizerCode')}
              <input
                value={unlockCode}
                onChange={(e) => setUnlockCode(formatOrganizerCode(e.target.value))}
                placeholder={t('organizerCodePlaceholder')}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            <div className="form-actions">
              <Link viewTransition className="btn btn-ghost" to="/">
                {t('goHome')}
              </Link>
              <button className="btn btn-accent" type="submit" disabled={unlockBusy}>
                {unlockBusy ? t('saving') : t('unlockEvent')}
              </button>
            </div>
          </form>
          <p className="sub" style={{ marginTop: '1rem' }}>
            {t('unlockEventRsvpHint')}{' '}
            <Link viewTransition to={`/rsvp/${gathering.id}`}>
              {t('openRsvp')}
            </Link>
          </p>
        </section>
      </>
    )
  }

  const rsvpUrl = `${window.location.origin}/rsvp/${gathering.id}`
  const event = gathering
  const typeLabel =
    event.type === 'lunch'
      ? t('typeLunch')
      : event.type === 'dinner'
        ? t('typeDinner')
        : event.type === 'brunch'
          ? t('typeBrunch')
          : t('typeOther')

  async function copyOrganizerCode() {
    if (!organizerCode) return
    try {
      await navigator.clipboard.writeText(organizerCode)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 1800)
    } catch {
      setCodeCopied(false)
    }
  }

  async function saveOrganizerCodeEdit(e: FormEvent) {
    e.preventDefault()
    if (codeBusy) return
    const next = formatOrganizerCode(codeDraft)
    const raw = next.replace(/[^a-zA-Z0-9]/g, '')
    if (raw.length < 6 || raw.length > 12) {
      setCodeError(true)
      setCodeMsg(t('organizerCodeInvalid'))
      return
    }
    setCodeBusy(true)
    setCodeError(false)
    setCodeMsg(null)
    try {
      await updateOrganizerCode(event.id, next)
      setEditingCode(false)
      setCodeMsg(t('organizerCodeUpdated'))
    } catch (err) {
      setCodeError(true)
      setCodeMsg(err instanceof Error ? err.message : t('organizerCodeUpdateFailed'))
    } finally {
      setCodeBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpUrl)
      setCopied(true)
      markShareDone(event.id)
      setShareDone(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function inviteText() {
    return buildInviteShareText({
      title: event.title,
      dateLabel: formatDate(event.date, localeTag, t('dateTbd')),
      time: event.time || '',
      location: event.location || '',
      rsvpUrl,
      locale,
    })
  }

  async function shareInviteNative() {
    const text = inviteText()
    const result = await nativeShare({
      title: event.title,
      text,
      url: rsvpUrl,
    })
    if (result === 'shared') {
      markShareDone(event.id)
      setShareDone(true)
      return
    }
    if (result === 'unsupported') {
      try {
        await navigator.clipboard.writeText(text)
        markShareDone(event.id)
        setShareDone(true)
        setShareMsg(t('shareCopiedInvite'))
        window.setTimeout(() => setShareMsg(null), 2000)
      } catch {
        // ignore
      }
    }
  }

  function shareInviteWhatsApp() {
    markShareDone(event.id)
    setShareDone(true)
    window.open(whatsappShareUrl(inviteText()), '_blank', 'noopener,noreferrer')
  }

  function downloadCalendar() {
    const ics = buildGatheringIcs({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      notes: event.notes,
      rsvpUrl,
    })
    if (!ics) return
    downloadIcs(`${event.title || 'event'}.ics`, ics)
  }

  function openFullReport() {
    setReportMsg(null)
    const html = buildEventReportHtml(
      event,
      {
        title: t('eventReportTitle'),
        generated: t('reportGenerated'),
        adults: t('adultsCount'),
        children: t('childrenCount'),
        summary: t('reportSummary'),
        invites: t('invites'),
        people: t('peopleTotal'),
        menuTotal: t('menuTotal'),
        stillDue: t('stillDue'),
        menu: t('pickFromMenu'),
        carte: t('pickFromCarte'),
        extras: t('menuRequestExtras'),
        allergies: t('allergiesDietary'),
        party: t('reportPerson'),
        contact: t('rsvpContact'),
        printHint: t('reportPrintHint'),
        noGuests: t('reportNoPeople'),
        dateTbd: t('dateTbd'),
        locationTbd: t('locationTbd'),
        carteTally: t('reportCarteTally'),
        dish: t('reportDish'),
        qty: t('reportQty'),
        noCartePicks: t('reportNoCartePicks'),
        menuTypeChart: t('reportMenuTypeChart'),
        avgCost: t('reportAvgCostHint'),
        avgPerPerson: t('reportAvgPerPerson'),
        priceVariable: t('priceVariable'),
        noMenuTypeData: t('reportNoMenuTypeData'),
        howToPay: t('paymentHowToPay'),
        iban: t('paymentIban'),
        mbWay: t('paymentMbWay'),
        bizum: t('paymentBizum'),
        payNote: t('paymentNote'),
      },
      localeTag,
    )
    const ok = openEventReport(html)
    if (!ok) setReportMsg(t('reportPopupBlocked'))
  }

  function openOrderSheet() {
    setReportMsg(null)
    const html = buildOrderSheetHtml(
      event,
      {
        title: t('orderSheetTitle'),
        generated: t('reportGenerated'),
        dish: t('reportDish'),
        qty: t('reportQty'),
        empty: t('orderSheetEmpty'),
        dateTbd: t('dateTbd'),
        locationTbd: t('locationTbd'),
        printHint: t('reportPrintHint'),
        carte: t('pickFromCarte'),
      },
      localeTag,
    )
    const ok = openEventReport(html)
    if (!ok) setReportMsg(t('reportPopupBlocked'))
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (detailsBusy) return
    setDetailsBusy(true)
    setDetailsMsg(null)
    setDetailsError(false)
    try {
      const prev = {
        date: event.date || '',
        time: event.time || '',
        location: (event.location || '').trim(),
      }
      const nextLoc = detailsForm.location.trim()
      await updateGathering(event.id, {
        title: detailsForm.title.trim() || event.title,
        notes: detailsForm.notes.trim(),
        date: detailsForm.date,
        time: detailsForm.time,
        location: nextLoc,
        organizerName: detailsForm.organizerName.trim(),
        organizerEmail: detailsForm.organizerEmail.trim(),
        organizerPhone: detailsForm.organizerPhone.trim(),
        rsvpDeadline: detailsForm.rsvpDeadline.trim(),
      })
      setDetailsMsg(pickFeedback(t, [...detailsSavedKeys]))
      setEditingDetails(false)
      const planChanged =
        prev.date !== detailsForm.date ||
        prev.time !== detailsForm.time ||
        prev.location !== nextLoc
      if (planChanged) {
        setChangePlanText(
          buildChangeOfPlanText({
            title: detailsForm.title.trim() || event.title,
            dateLabel: formatDate(detailsForm.date, localeTag, t('dateTbd')),
            time: detailsForm.time || '',
            location: nextLoc,
            rsvpUrl,
            locale,
          }),
        )
      }
    } catch (err) {
      setDetailsError(true)
      setDetailsMsg(err instanceof Error ? err.message : t('detailsSaveFailed'))
    } finally {
      setDetailsBusy(false)
    }
  }

  function cancelEditDetails() {
    setDetailsForm({
      title: event.title || '',
      notes: event.notes || '',
      date: event.date || '',
      time: event.time || '',
      location: event.location || '',
      organizerName: event.organizerName || '',
      organizerEmail: event.organizerEmail || '',
      organizerPhone: event.organizerPhone || '',
      paymentIban: event.paymentIban || '',
      paymentMbWay: event.paymentMbWay || '',
      paymentBizum: event.paymentBizum || '',
      paymentNote: event.paymentNote || '',
      paymentQrUrl: event.paymentQrUrl || '',
      rsvpDeadline: event.rsvpDeadline || '',
      rsvpClosed: Boolean(event.rsvpClosed),
    })
    setEditingDetails(false)
    setDetailsMsg(null)
    setDetailsError(false)
  }

  async function onSavePaymentInstructions(e: FormEvent) {
    e.preventDefault()
    if (payFormBusy) return
    setPayFormBusy(true)
    setPayFormMsg(null)
    try {
      await updateGathering(event.id, {
        paymentIban: detailsForm.paymentIban.trim(),
        paymentMbWay: detailsForm.paymentMbWay.trim(),
        paymentBizum: detailsForm.paymentBizum.trim(),
        paymentNote: detailsForm.paymentNote.trim(),
        paymentQrUrl: detailsForm.paymentQrUrl.trim(),
      })
      setPayFormMsg(t('paymentInstructionsSaved'))
    } catch (err) {
      setPayFormMsg(err instanceof Error ? err.message : t('detailsSaveFailed'))
    } finally {
      setPayFormBusy(false)
    }
  }

  async function onAddMenu(e: FormEvent) {
    e.preventDefault()
    if (!gathering) return
    const isAlaCarte = menuForm.kind === 'alacarte'
    const price = Number(menuForm.price)
    if (!menuForm.name.trim() || busy) return
    if (!isAlaCarte && (Number.isNaN(price) || price < 0)) return
    setBusy(true)
    try {
      await addMenuItem(gathering.id, {
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        exclusions: isAlaCarte ? '' : menuForm.exclusions.trim(),
        price: isAlaCarte ? 0 : price,
        category: isAlaCarte ? t('alaCarte') : t('setMenu'),
        isAlaCarte,
      })
      setMenuForm({
        name: '',
        description: '',
        exclusions: '',
        price: '',
        kind: 'set',
      })
      setMenuMsg(pickFeedback(t, [...menuItemSavedKeys]))
    } finally {
      setBusy(false)
    }
  }

  async function clearMenuCard() {
    if (!gathering || cardBusy) return
    setCardBusy(true)
    setCardMsg(null)
    try {
      await setMenuCard(gathering.id, '')
      setCardLink('')
      setCardMsg(t('menuCardCleared'))
    } catch (err) {
      setCardMsg(err instanceof Error ? err.message : t('menuCardClear'))
    } finally {
      setCardBusy(false)
    }
  }

  async function saveCardLink() {
    if (!gathering || cardBusy) return
    setCardBusy(true)
    setCardMsg(null)
    try {
      await setMenuCard(gathering.id, cardLink.trim())
      setCardMsg(pickFeedback(t, [...menuCardSavedKeys]))
    } catch (err) {
      setCardMsg(err instanceof Error ? err.message : t('menuCardSaved'))
    } finally {
      setCardBusy(false)
    }
  }

  async function onUploadCard(file: File | null) {
    if (!file || !gathering) return
    setCardBusy(true)
    setCardMsg(t('menuCardUploading'))
    try {
      const dataUrl = await compressImageFile(file)
      await setMenuCard(gathering.id, dataUrl)
      setCardLink('')
      setCardMsg(pickFeedback(t, [...menuCardSavedKeys]))
    } catch (err) {
      setCardMsg(err instanceof Error ? err.message : t('menuCardUploading'))
    } finally {
      setCardBusy(false)
    }
  }

  async function onAddGuest(e: FormEvent) {
    e.preventDefault()
    if (!gathering || guestBusy) return
    const displayName = guestForm.name.trim()
    if (!displayName) return

    setGuestBusy(true)
    setGuestMsg(null)
    setGuestError(false)
    try {
      await addAttendee(gathering.id, {
        name: displayName,
        registeredBy: t('registeredByOrganizer'),
        email: guestForm.email.trim(),
        phone: guestForm.phone.trim(),
        menuItemIds: guestForm.menuItemIds,
        carteItemIds: guestForm.carteItemIds,
        allergies: guestForm.allergies.trim(),
        notes: guestForm.notes.trim(),
        menuRequest: guestForm.menuRequest.trim(),
        ageGroup: guestForm.ageGroup,
        isGroup: false,
        groupSize: 1,
        members: [],
      })
      setGuestForm({
        name: '',
        asGroup: false,
        menuItemIds: [],
        carteItemIds: [],
        allergies: '',
        email: '',
        phone: '',
        notes: '',
        menuRequest: '',
        ageGroup: 'adult',
      })
      setShowGuestForm(false)
      setGuestMsg(pickFeedback(t, [...guestAddedKeys]))
    } catch (err) {
      setGuestError(true)
      setGuestMsg(err instanceof Error ? err.message : t('guestAdded'))
    } finally {
      setGuestBusy(false)
    }
  }

  const guided = Boolean(coachStep && coachStep !== 'done')
  const activePhase: Phase =
    coachStep === 'share' || coachStep === 'done'
      ? 'invite'
      : coachStep === 'menu' || coachStep === 'code'
        ? 'setup'
        : phase || 'setup'
  const showMetrics = !guided && (activePhase === 'run' || activePhase === 'wrap')
  const showCodePanel =
    (!guided && (codePanelOpen || justCreated || activePhase === 'setup')) ||
    coachStep === 'code'
  const showSetupDetails = activePhase === 'setup' && !guided
  const showSetupMenu = activePhase === 'setup' && (!guided || coachStep === 'menu')
  const showSetupShare =
    activePhase === 'invite' && (!guided || coachStep === 'share' || coachStep === 'done')
  const showTabs = activePhase === 'run' && !guided
  const showWrap = activePhase === 'wrap' && !guided
  const tabOptions = [
    ['guests', 'tabGuests'],
    ['payments', 'tabPayments'],
    ['kitchen', 'kitchenTab'],
    ['inbox', 'tabInbox'],
  ] as const
  const step1Done = Boolean(gathering.date && gathering.location)
  const step2Done = Boolean(
    gathering.menuCardUrl || (gathering.carteItems || []).length > 0,
  )
  const step3Done = gathering.menu.length > 0
  const setupReadyToInvite = step1Done && step3Done
  const rsvpOpen = isRsvpOpen(gathering)
  const unpaidCount = gathering.attendees.filter((a) => {
    if (a.isGroup && a.members?.length) {
      return a.members.some((m) => (m.amountPaid || 0) <= 0)
    }
    return (a.amountPaid || 0) <= 0
  }).length
  const unreadInbox = (gathering.messages || []).filter((m) => !m.read).length

  return (
    <>
      <header className="topbar">
        <Link viewTransition to="/" className="brand">
          <i className="brand-mark" aria-hidden />
          Round<span>.</span>
        </Link>
        <div className="nav-actions">
          <LanguageSwitcher />
          {canManage && (
            <div className="topbar-more">
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                {t('moreActionsMenu')}
              </button>
              {moreOpen && (
                <div className="topbar-more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setMoreOpen(false)
                      if (coachStep) {
                        markAssistedComplete()
                        setCoachStep(null)
                        setSearchParams({}, { replace: true })
                        return
                      }
                      resetAssistedMode()
                      setCoachStep('code')
                      setPhase('setup')
                      setCodePanelOpen(true)
                      setTab('guests')
                    }}
                  >
                    {coachStep ? t('demoExit') : t('demoStart')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setMoreOpen(false)
                      void (async () => {
                        if (!confirm(t('deleteConfirm'))) return
                        await deleteGathering(gathering.id)
                        navigate('/', { viewTransition: true })
                      })()
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {guided && (
        <p className="organizer-guided-banner" role="status">
          {t('organizerGuidedFocus')}
        </p>
      )}

      <section className="event-stage">
        <div className="event-stage-copy">
          <div className="event-stage-meta">
            <span className="chip">{typeLabel}</span>
            <span className="chip chip-warm">
              {formatDate(gathering.date, localeTag, t('dateTbd'))}
            </span>
            {gathering.time && <span className="chip chip-muted">{gathering.time}</span>}
          </div>
          <h1>{gathering.title}</h1>
          <p className="event-stage-where">
            {gathering.location || t('locationTbd')}
          </p>
          {gathering.notes && <p className="event-stage-notes">{gathering.notes}</p>}
          {totals.hasVariable && (
            <p className="event-stage-notes">{t('hasVariableNote')}</p>
          )}
        </div>

        {showMetrics && (
          <div className="event-stage-metrics" aria-label={t('peopleTotal')}>
            <div>
              <span>{t('peopleTotal')}</span>
              <strong>{totals.guestCount}</strong>
            </div>
            <div>
              <span>{t('invites')}</span>
              <strong>{totals.inviteCount}</strong>
            </div>
            <div>
              <span>{t('menuTotal')}</span>
              <strong>{formatMoney(totals.owed, gathering.currency, localeTag)}</strong>
            </div>
            <div>
              <span>{t('stillDue')}</span>
              <strong>{formatMoney(totals.outstanding, gathering.currency, localeTag)}</strong>
            </div>
          </div>
        )}
      </section>

      {!guided && canManage && (
        <nav className="phase-nav" aria-label={t('phaseNavLabel')}>
          {(
            [
              ['setup', 'phaseSetup'],
              ['invite', 'phaseInvite'],
              ['run', 'phaseRun'],
              ['wrap', 'phaseWrap'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`phase-nav-btn ${activePhase === key ? 'active' : ''}`}
              onClick={() => setPhase(key)}
            >
              {t(label)}
            </button>
          ))}
        </nav>
      )}

      {(showSetupDetails || showSetupMenu || showSetupShare) && (
        <div className="organizer-setup">
          {activePhase === 'setup' && !guided && (
            <>
              <div className="organizer-setup-intro">
                <h2>{t('setupFlowTitle')}</h2>
                <p className="sub">{t('setupFlowSub')}</p>
                {setupReadyToInvite ? (
                  <p className="sub">{t('inviteWhenMenuReady')}</p>
                ) : (
                  <p className="sub">{t('setupPayLaterHint')}</p>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setPhase('run')
                    setTab('payments')
                  }}
                >
                  {t('goToPayments')}
                </button>
              </div>
              <div className="setup-accordion-status" aria-label={t('setupFlowMapLabel')}>
                <span className={step1Done ? 'done' : ''}>{t('setupStep1Short')}</span>
                <span className={step2Done ? 'done' : ''}>{t('setupStep2Short')}</span>
                <span className={step3Done ? 'done' : ''}>{t('setupStep3Short')}</span>
              </div>
            </>
          )}
          {activePhase === 'invite' && !guided && (
            <div className="organizer-setup-intro">
              <h2>{t('inviteWhatFriendsSee')}</h2>
              <p className="sub">{t('inviteIntentSub')}</p>
            </div>
          )}

          {showSetupDetails && (
            <section
              id="setup-step-1"
              className={`panel setup-step ${step1Done && !editingDetails ? 'setup-step-collapsed' : ''}`}
            >
              <div className="setup-step-head">
                <div className="setup-step-copy">
                  <h2>{t('setupStep1')}</h2>
                  <p className="sub">{t('setupStep1Sub')}</p>
                </div>
                {step1Done && !editingDetails && <span className="chip">{t('setupStepDone')}</span>}
                {!editingDetails ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingDetails(true)
                      setDetailsMsg(null)
                      setDetailsError(false)
                    }}
                  >
                    {t('editEventDetails')}
                  </button>
                ) : (
                  <span className="chip chip-warm">{t('editingLabel')}</span>
                )}
              </div>
              {detailsMsg && (
                <div
                  className={`feedback-banner ${detailsError ? 'error' : ''}`}
                  role="status"
                >
                  {detailsMsg}
                </div>
              )}
              {changePlanText && (
                <div className="feedback-banner change-plan-banner" role="status">
                  <p>{t('changeOfPlanReady')}</p>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-accent"
                      onClick={() =>
                        window.open(
                          whatsappShareUrl(changePlanText),
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      {t('changeOfPlanWhatsApp')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(changePlanText)
                      }}
                    >
                      {t('changeOfPlanCopy')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setChangePlanText(null)}
                    >
                      {t('dismiss')}
                    </button>
                  </div>
                </div>
              )}

              {!editingDetails ? (
                <dl className="details-summary">
                  <div className="full">
                    <dt>{t('eventTitleField')}</dt>
                    <dd>{gathering.title}</dd>
                  </div>
                  <div>
                    <dt>{t('date')}</dt>
                    <dd>
                      {gathering.date
                        ? formatDate(gathering.date, localeTag, t('dateTbd'))
                        : t('dateTbd')}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('time')}</dt>
                    <dd>{gathering.time || '—'}</dd>
                  </div>
                  <div className="full">
                    <dt>{t('location')}</dt>
                    <dd>{gathering.location || t('locationTbd')}</dd>
                  </div>
                  <div>
                    <dt>{t('organizerName')}</dt>
                    <dd>{gathering.organizerName || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('organizerEmail')}</dt>
                    <dd>{gathering.organizerEmail || '—'}</dd>
                  </div>
                  <div className="full">
                    <dt>{t('organizerPhone')}</dt>
                    <dd>{gathering.organizerPhone || '—'}</dd>
                  </div>
                  {gathering.notes.trim() && (
                    <div className="full">
                      <dt>{t('eventNotesField')}</dt>
                      <dd>{gathering.notes}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('rsvpDeadline')}</dt>
                    <dd>
                      {gathering.rsvpDeadline
                        ? formatDate(gathering.rsvpDeadline, localeTag, t('dateTbd'))
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <form onSubmit={(e) => void onSaveDetails(e)}>
                  <div className="form-grid">
                    <label className="full">
                      {t('eventTitleField')}
                      <input
                        value={detailsForm.title}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, title: e.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      {t('date')}
                      <input
                        type="date"
                        value={detailsForm.date}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, date: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t('time')}
                      <input
                        type="time"
                        value={detailsForm.time}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, time: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      {t('location')}
                      <input
                        value={detailsForm.location}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, location: e.target.value })
                        }
                        placeholder={t('placeholderLocation')}
                      />
                    </label>
                    <label>
                      {t('organizerName')}
                      <input
                        value={detailsForm.organizerName}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, organizerName: e.target.value })
                        }
                        placeholder={t('organizerNamePlaceholder')}
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      {t('organizerEmail')}
                      <input
                        type="email"
                        value={detailsForm.organizerEmail}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, organizerEmail: e.target.value })
                        }
                        placeholder={t('placeholderEmail')}
                        autoComplete="email"
                      />
                    </label>
                    <label className="full">
                      {t('organizerPhone')}
                      <input
                        type="tel"
                        value={detailsForm.organizerPhone}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, organizerPhone: e.target.value })
                        }
                        placeholder={t('placeholderPhone')}
                        autoComplete="tel"
                      />
                    </label>
                    <label className="full">
                      {t('eventNotesField')}
                      <textarea
                        value={detailsForm.notes}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, notes: e.target.value })
                        }
                        rows={2}
                      />
                    </label>
                    <label>
                      {t('rsvpDeadline')}
                      <input
                        type="date"
                        value={detailsForm.rsvpDeadline}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, rsvpDeadline: e.target.value })
                        }
                      />
                    </label>
                    <p className="sub full">{t('rsvpDeadlineHint')}</p>
                    <p className="sub full">{t('setupPayInfoHint')}</p>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-accent" type="submit" disabled={detailsBusy}>
                      {detailsBusy ? t('saving') : t('saveDetails')}
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={cancelEditDetails}
                      disabled={detailsBusy}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          {showSetupMenu && (
            <div
              ref={menuFocusRef}
              className={`setup-menu-block ${coachStep === 'menu' ? 'coach-target' : ''}`}
            >
              {coachStep === 'menu' && (
                <p className="demo-inline-tip">{t('demoTipMenu')}</p>
              )}

              <section id="setup-step-2" className="panel setup-step">
                <div className="setup-step-head">
                  <span className={`setup-step-num ${step2Done ? 'done' : ''}`} aria-hidden>
                    2
                  </span>
                  <div className="setup-step-copy">
                    <h2>{t('setupStep2')}</h2>
                    <p className="sub">{t('setupStep2Sub')}</p>
                  </div>
                  <span className="chip chip-muted">{t('setupStepOptional')}</span>
                  {step2Done && <span className="chip">{t('setupStepDone')}</span>}
                </div>
                <ImageUploadDropzone
                  busy={cardBusy}
                  onFile={(file) => void onUploadCard(file)}
                />
                <details className="menu-card-link-fold">
                  <summary>{t('menuCardOrLink')}</summary>
                  <label className="full">
                    {t('menuCardLink')}
                    <input
                      value={cardLink}
                      onChange={(e) => setCardLink(e.target.value)}
                      placeholder={t('menuCardLinkPlaceholder')}
                    />
                  </label>
                  <div className="form-actions" style={{ marginTop: '0.65rem' }}>
                    <button
                      className="btn btn-accent"
                      type="button"
                      disabled={cardBusy || !cardLink.trim()}
                      onClick={() => void saveCardLink()}
                    >
                      {cardBusy ? t('menuCardUploading') : t('menuCardSave')}
                    </button>
                  </div>
                </details>
                {cardMsg && (
                  <div className="feedback-banner" role="status" style={{ marginTop: '0.75rem' }}>
                    {cardMsg}
                  </div>
                )}
                {safeMediaUrl(gathering.menuCardUrl) && (
                  <div className="menu-card-preview">
                    <img src={safeMediaUrl(gathering.menuCardUrl)} alt={t('menuCard')} />
                    <div className="menu-card-preview-actions">
                      {!safeMediaUrl(gathering.menuCardUrl).startsWith('data:') && (
                        <a
                          className="btn btn-ghost btn-sm"
                          href={safeMediaUrl(gathering.menuCardUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('menuCardOpen')}
                        </a>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        disabled={cardBusy}
                        onClick={() => void clearMenuCard()}
                      >
                        {t('menuCardClear')}
                      </button>
                    </div>
                  </div>
                )}
                {!safeMediaUrl(gathering.menuCardUrl) && gathering.menuCardUrl && (
                  <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      disabled={cardBusy}
                      onClick={() => void clearMenuCard()}
                    >
                      {t('menuCardClear')}
                    </button>
                  </div>
                )}
              </section>

              <EventCarteEditor
                gathering={gathering}
                onSave={(items, approved) => setMenuCarte(gathering.id, items, approved)}
              />

              <div className="layout-split setup-step-options">
                <section id="setup-step-3" className="panel setup-step">
                  <div className="setup-step-head">
                    <span className={`setup-step-num ${step3Done ? 'done' : ''}`} aria-hidden>
                      3
                    </span>
                    <div className="setup-step-copy">
                      <h2>{t('setupStep3')}</h2>
                      <p className="sub">{t('setupStep3Sub')}</p>
                    </div>
                    {step3Done && <span className="chip">{t('setupStepDone')}</span>}
                  </div>
                  {menuMsg && (
                    <div className="feedback-banner" role="status">
                      {menuMsg}
                    </div>
                  )}
                  <form onSubmit={(e) => void onAddMenu(e)}>
                    <div className="menu-kind" role="group" aria-label={t('menuKindLabel')}>
                      <button
                        type="button"
                        className={`menu-kind-option ${menuForm.kind === 'set' ? 'selected' : ''}`}
                        aria-pressed={menuForm.kind === 'set'}
                        onClick={() => setMenuForm({ ...menuForm, kind: 'set' })}
                      >
                        <strong>{t('setMenu')}</strong>
                        <span>{t('setMenuSub')}</span>
                      </button>
                      <button
                        type="button"
                        className={`menu-kind-option ${menuForm.kind === 'alacarte' ? 'selected' : ''}`}
                        aria-pressed={menuForm.kind === 'alacarte'}
                        onClick={() =>
                          setMenuForm({
                            ...menuForm,
                            kind: 'alacarte',
                            price: '',
                            exclusions: '',
                          })
                        }
                      >
                        <strong>{t('alaCarte')}</strong>
                        <span>{t('alaCarteHint')}</span>
                      </button>
                    </div>

                    <div className="form-grid">
                      <label className="full">
                        {menuForm.kind === 'set' ? t('setMenuName') : t('alaCarteName')}
                        <input
                          required
                          value={menuForm.name}
                          onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                          placeholder={
                            menuForm.kind === 'set'
                              ? t('setMenuNamePlaceholder')
                              : t('alaCarteNamePlaceholder')
                          }
                        />
                      </label>

                      {menuForm.kind === 'set' ? (
                        <>
                          <label className="full">
                            {t('pricePerPerson')} ({gathering.currency})
                            <input
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={menuForm.price}
                              onChange={(e) =>
                                setMenuForm({ ...menuForm, price: e.target.value })
                              }
                              placeholder="25.00"
                            />
                          </label>
                          <label className="full">
                            {t('setMenuIncludes')}
                            <textarea
                              value={menuForm.description}
                              onChange={(e) =>
                                setMenuForm({ ...menuForm, description: e.target.value })
                              }
                              placeholder={t('setMenuIncludesPlaceholder')}
                              rows={3}
                            />
                          </label>
                          <label className="full">
                            {t('setMenuExclusions')}
                            <textarea
                              value={menuForm.exclusions}
                              onChange={(e) =>
                                setMenuForm({ ...menuForm, exclusions: e.target.value })
                              }
                              placeholder={t('setMenuExclusionsPlaceholder')}
                              rows={2}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="full">
                          {t('description')}
                          <textarea
                            value={menuForm.description}
                            onChange={(e) =>
                              setMenuForm({ ...menuForm, description: e.target.value })
                            }
                            placeholder={t('alaCarteDescPlaceholder')}
                            rows={2}
                          />
                        </label>
                      )}
                    </div>
                    <div className="form-actions">
                      <button className="btn btn-accent" type="submit" disabled={busy}>
                        {busy ? t('adding') : t('addToMenu')}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="panel setup-step">
                  <h2>{t('currentMenu')}</h2>
                  <p className="sub">{t('optionsAvailable', { count: gathering.menu.length })}</p>
                  {gathering.menu.length === 0 ? (
                    <div className="empty">{t('addOptionBeforeShare')}</div>
                  ) : (
                    <div className="menu-list">
                      {gathering.menu.map((item) => (
                        <div key={item.id} className="menu-row">
                          <div>
                            <span className="chip chip-muted">
                              {item.isAlaCarte ? t('alaCarte') : t('setMenu')}
                            </span>
                            <h4>{item.name}</h4>
                            {item.description && (
                              <p>
                                <strong>
                                  {item.isAlaCarte ? '' : `${t('setMenuIncludes')}: `}
                                </strong>
                                {item.description}
                              </p>
                            )}
                            {!item.isAlaCarte && item.exclusions && (
                              <p className="menu-exclusions">
                                <strong>{t('setMenuExclusions')}: </strong>
                                {item.exclusions}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="price">
                              {item.isAlaCarte
                                ? t('priceVariable')
                                : formatMoney(item.price, gathering.currency, localeTag)}
                            </div>
                            <div className="row-actions">
                              <button
                                className="btn btn-danger btn-sm"
                                type="button"
                                onClick={() => void removeMenuItem(gathering.id, item.id)}
                              >
                                {t('remove')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {showSetupShare && (
            <section
              id="setup-step-4"
              className={`panel setup-step invite-phase-panel ${coachStep === 'share' || coachStep === 'done' ? 'coach-target' : ''}`}
              ref={shareBoxRef}
            >
              {(coachStep === 'share' || coachStep === 'done') && (
                <p className="demo-inline-tip">{t('demoTipShare')}</p>
              )}
              {!rsvpOpen && (
                <div className="feedback-banner" role="status">
                  {t('rsvpClosedBanner')}
                </div>
              )}
              {shareMsg && (
                <div className="feedback-banner" role="status">
                  {shareMsg}
                </div>
              )}
              <InviteCard gathering={gathering} className="invite-card-enter" />
              <div className="invite-share-primary">
                <button
                  className="btn btn-accent"
                  type="button"
                  onClick={shareInviteWhatsApp}
                >
                  {t('shareWhatsApp')}
                </button>
              </div>
              <div className="setup-share-actions invite-share-secondary">
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => void copyLink()}
                >
                  {copied ? t('copied') : t('copyInviteLink')}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => void shareInviteNative()}
                >
                  {t('shareNative')}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={downloadCalendar}
                  disabled={!gathering.date}
                >
                  {t('addToCalendar')}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => setShowWalkUpQr((v) => !v)}
                >
                  {showWalkUpQr ? t('hideWalkUpQr') : t('showWalkUpQr')}
                </button>
              </div>
              {showWalkUpQr && (
                <div className="setup-share-qr">
                  <img
                    src={rsvpQrImageUrl(rsvpUrl, 200)}
                    alt={t('walkUpQrAlt')}
                    width={200}
                    height={200}
                    loading="lazy"
                  />
                  <p className="sub">{t('walkUpQrHint')}</p>
                </div>
              )}
              <p className="sub invite-link-mono">
                <code>{rsvpUrl}</code>
              </p>
            </section>
          )}
        </div>
      )}

      {showCodePanel && organizerCode && (
        <details
          ref={codePanelRef}
          className={`panel organizer-code-panel ${justCreated ? 'is-new' : ''} ${
            coachStep === 'code' ? 'coach-target' : ''
          }`}
          style={{ marginBottom: '1rem' }}
          open={justCreated || coachStep === 'code' || codePanelOpen}
          onToggle={(e) => setCodePanelOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="code-panel-summary">
            <strong>{t('howIManage')}</strong>
            <span className="sub">{t('organizerCode')}</span>
          </summary>
          {coachStep === 'code' && (
            <p className="demo-inline-tip">{t('demoTipCode')}</p>
          )}
          <h2>{t('organizerCodeTitle')}</h2>
          <p className="sub">
            {justCreated ? t('organizerCodeNewSub') : t('organizerCodeSub')}
          </p>
          {codeMsg && (
            <div
              className={`feedback-banner ${codeError ? 'error' : ''}`}
              role="status"
              style={{ marginTop: '0.75rem' }}
            >
              {codeMsg}
            </div>
          )}
          {editingCode ? (
            <form onSubmit={(e) => void saveOrganizerCodeEdit(e)}>
              <label className="full" style={{ marginTop: '0.75rem' }}>
                {t('organizerCode')}
                <input
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(formatOrganizerCode(e.target.value))}
                  placeholder={t('organizerCodePlaceholder')}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
              </label>
              <p className="sub">{t('organizerCodeEditHint')}</p>
              <div className="form-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={codeBusy}
                  onClick={() => {
                    setEditingCode(false)
                    setCodeDraft(organizerCode)
                    setCodeMsg(null)
                    setCodeError(false)
                  }}
                >
                  {t('cancel')}
                </button>
                <button className="btn btn-accent" type="submit" disabled={codeBusy}>
                  {codeBusy ? t('saving') : t('saveOrganizerCode')}
                </button>
              </div>
            </form>
          ) : (
            <div className="share-box" style={{ margin: '0.75rem 0 0' }}>
              <strong>{t('organizerCode')}</strong>
              <code>{organizerCode}</code>
              <button
                className="btn btn-sm btn-accent"
                type="button"
                onClick={() => void copyOrganizerCode()}
              >
                {codeCopied ? t('copied') : t('copyCode')}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                type="button"
                onClick={() => {
                  setEditingCode(true)
                  setCodeDraft(organizerCode)
                  setCodeMsg(null)
                  setCodeError(false)
                }}
              >
                {t('editOrganizerCode')}
              </button>
              {justCreated && (
                <button
                  className="btn btn-sm btn-ghost"
                  type="button"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  {t('codeSavedDismiss')}
                </button>
              )}
            </div>
          )}
        </details>
      )}
      {reportMsg && (
        <p className="allergy" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
          {reportMsg}
        </p>
      )}

      {showTabs && (
        <>
      <div className="organizer-manage">
        <div className="organizer-manage-intro">
          <h2>{t('setupManageTitle')}</h2>
          <p className="sub">{t('setupManageSub')}</p>
        </div>
      <div className="tabs">
        {tabOptions.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(label)}
            {key === 'guests' && gathering.attendees.length > 0 && (
              <span className="tab-badge">{gathering.attendees.length}</span>
            )}
            {key === 'payments' && unpaidCount > 0 && (
              <span className="tab-badge">{unpaidCount}</span>
            )}
            {key === 'inbox' && unreadInbox > 0 && (
              <span className="tab-badge">{unreadInbox}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'guests' && (
        <div className="layout-split">
          <section className="panel">
            <div className="details-panel-head">
              <div>
                <h2>{t('whosComing')}</h2>
                <p className="sub">{t('whosComingSub')}</p>
              </div>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => {
                  setShowGuestForm((v) => !v)
                  setGuestForm((prev) => ({ ...prev, asGroup: false }))
                }}
              >
                {showGuestForm ? t('cancel') : t('organizerAddGuest')}
              </button>
            </div>
            {gathering.attendees.length === 0 ? (
              <div className="empty empty-with-cta">
                <p>{t('noRsvpsYet')}</p>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => setPhase('invite')}
                >
                  {t('noGuestsInviteCta')}
                </button>
              </div>
            ) : (
              <div className="guest-list">
                {gathering.attendees.map((a) => (
                  <GuestEditor
                    key={a.id}
                    gathering={gathering}
                    attendee={a}
                    editing={editingGuestId === a.id}
                    onToggleEdit={() =>
                      setEditingGuestId((id) => (id === a.id ? null : a.id))
                    }
                    onSave={async (patch) => {
                      await updateAttendee(gathering.id, a.id, patch)
                      setEditingGuestId(null)
                    }}
                    onRemove={() => void removeAttendee(gathering.id, a.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {showGuestForm && (
            <section className="panel">
              <h2>{t('organizerRegister')}</h2>
              <p className="sub">{t('addGuestCompactSub')}</p>
              {guestMsg && (
                <div
                  className={`feedback-banner ${guestError ? 'error' : ''}`}
                  role="status"
                >
                  {guestMsg}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  setGuestForm((prev) => ({ ...prev, asGroup: false }))
                  void onAddGuest(e)
                }}
              >
                <div className="form-grid">
                  <label className="full">
                    {t('guestName')}
                    <input
                      required
                      autoComplete="name"
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      placeholder="Alex"
                    />
                  </label>
                  <label>
                    {t('emailOptional')}
                    <input
                      type="email"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      placeholder={t('placeholderEmail')}
                    />
                  </label>
                  <div className="full">
                    <AgeGroupPicker
                      value={guestForm.ageGroup}
                      onChange={(value) =>
                        setGuestForm({ ...guestForm, ageGroup: value })
                      }
                    />
                  </div>
                  <label className="full">
                    {t('allergiesDietary')}
                    <input
                      value={guestForm.allergies}
                      onChange={(e) =>
                        setGuestForm({ ...guestForm, allergies: e.target.value })
                      }
                      placeholder={t('placeholderAllergies')}
                    />
                  </label>
                </div>
                {gathering.menu.length > 0 && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <p className="sub" style={{ marginBottom: '0.5rem' }}>
                      {t('pickFromMenu')}
                    </p>
                    <MenuPicker
                      menu={gathering.menu}
                      selectedIds={guestForm.menuItemIds}
                      currency={gathering.currency}
                      onToggle={(itemId) =>
                        setGuestForm((prev) => ({
                          ...prev,
                          menuItemIds: toggleMenuSelection(
                            prev.menuItemIds,
                            itemId,
                            gathering.menu,
                          ),
                        }))
                      }
                      emptyLabel={t('organizerNoMenu')}
                    />
                  </div>
                )}
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                  <button className="btn btn-accent" type="submit" disabled={guestBusy}>
                    {guestBusy ? t('saving') : t('addGuest')}
                  </button>
                  <Link
                    viewTransition
                    className="btn btn-ghost"
                    to={`/rsvp/${gathering.id}`}
                  >
                    {t('addGuestFullRsvp')}
                  </Link>
                </div>
              </form>
            </section>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <section className="panel">
          <h2>{t('inboxTitle')}</h2>
          <p className="sub">{t('inboxSub')}</p>
          {(gathering.messages || []).length === 0 ? (
            <div className="empty">{t('inboxEmpty')}</div>
          ) : (
            <div className="inbox-list">
              {(gathering.messages || []).map((message) => (
                <article
                  key={message.id}
                  className={`inbox-item ${message.read ? '' : 'unread'}`}
                >
                  <div className="inbox-item-head">
                    <div>
                      <h4>{message.fromName}</h4>
                      <p className="sub">
                        {[message.fromEmail, message.fromPhone]
                          .filter(Boolean)
                          .join(' · ') || t('noContactDetails')}
                        {' · '}
                        {new Date(message.createdAt).toLocaleString(localeTag)}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          void markMessageRead(
                            gathering.id,
                            message.id,
                            !message.read,
                          )
                        }
                      >
                        {message.read ? t('markUnread') : t('markRead')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void deleteMessage(gathering.id, message.id)}
                      >
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                  <p className="inbox-body">{message.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'payments' && (
        <section className="panel">
          <h2>{t('paymentTracking')}</h2>
          <p className="sub">{t('paymentTrackingSub')}</p>
          <form
            className="payment-instructions-form"
            onSubmit={(e) => void onSavePaymentInstructions(e)}
          >
            <h3>{t('paymentHowToPay')}</h3>
            <p className="sub">{t('paymentHowToPaySub')}</p>
            {payFormMsg && (
              <div className="feedback-banner" role="status">
                {payFormMsg}
              </div>
            )}
            <div className="form-grid">
              <label>
                {t('paymentIban')}
                <input
                  value={detailsForm.paymentIban}
                  onChange={(e) =>
                    setDetailsForm({ ...detailsForm, paymentIban: e.target.value })
                  }
                />
              </label>
              <label>
                {t('paymentMbWay')}
                <input
                  value={detailsForm.paymentMbWay}
                  onChange={(e) =>
                    setDetailsForm({ ...detailsForm, paymentMbWay: e.target.value })
                  }
                />
              </label>
              <label>
                {t('paymentBizum')}
                <input
                  value={detailsForm.paymentBizum}
                  onChange={(e) =>
                    setDetailsForm({ ...detailsForm, paymentBizum: e.target.value })
                  }
                />
              </label>
              <label className="full">
                {t('paymentNote')}
                <textarea
                  value={detailsForm.paymentNote}
                  onChange={(e) =>
                    setDetailsForm({ ...detailsForm, paymentNote: e.target.value })
                  }
                  rows={2}
                />
              </label>
              <label className="full">
                {t('paymentQr')}
                <input
                  value={detailsForm.paymentQrUrl}
                  onChange={(e) =>
                    setDetailsForm({ ...detailsForm, paymentQrUrl: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-accent btn-sm" type="submit" disabled={payFormBusy}>
                {payFormBusy ? t('saving') : t('paymentSaveInstructions')}
              </button>
            </div>
          </form>
          {hasPaymentInstructions(gathering) && (
            <PaymentInstructionsView gathering={gathering} />
          )}
          <PaymentBoard
            gathering={gathering}
            onUpdateAttendee={(attendeeId, patch) =>
              updateAttendee(gathering.id, attendeeId, patch)
            }
          />
        </section>
      )}

      {tab === 'kitchen' && (
        <section className="panel">
          <h2>{t('kitchenTitle')}</h2>
          <p className="sub">{t('kitchenSub')}</p>
          <div className="form-actions" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={openOrderSheet}
            >
              {t('openOrderSheet')}
            </button>
          </div>
          <KitchenBoard gathering={gathering} />
        </section>
      )}
      </div>
        </>
      )}

      {showWrap && (
        <section className="panel wrap-phase">
          <h2>{t('wrapTitle')}</h2>
          <p className="sub">{t('wrapSub')}</p>
          {changePlanText && (
            <div className="feedback-banner change-plan-banner" role="status">
              <p>{t('changeOfPlanReady')}</p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() =>
                    window.open(
                      whatsappShareUrl(changePlanText),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  {t('changeOfPlanWhatsApp')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(changePlanText)
                  }}
                >
                  {t('changeOfPlanCopy')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setChangePlanText(null)}
                >
                  {t('dismiss')}
                </button>
              </div>
            </div>
          )}
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                setDetailsBusy(true)
                try {
                  await updateGathering(gathering.id, {
                    rsvpClosed: detailsForm.rsvpClosed,
                    rsvpDeadline: detailsForm.rsvpDeadline.trim(),
                  })
                  setDetailsMsg(pickFeedback(t, [...detailsSavedKeys]))
                } catch (err) {
                  setDetailsError(true)
                  setDetailsMsg(
                    err instanceof Error ? err.message : t('detailsSaveFailed'),
                  )
                } finally {
                  setDetailsBusy(false)
                }
              })()
            }}
          >
            <label>
              {t('rsvpDeadline')}
              <input
                type="date"
                value={detailsForm.rsvpDeadline}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, rsvpDeadline: e.target.value })
                }
              />
            </label>
            <label className="full checkbox-row">
              <input
                type="checkbox"
                checked={detailsForm.rsvpClosed}
                onChange={(e) =>
                  setDetailsForm({ ...detailsForm, rsvpClosed: e.target.checked })
                }
              />
              <span>
                {t('rsvpClosedToggle')}
                <span className="sub"> — {t('rsvpClosedHint')}</span>
              </span>
            </label>
            <div className="form-actions full">
              <button className="btn btn-accent btn-sm" type="submit" disabled={detailsBusy}>
                {detailsBusy ? t('saving') : t('saveDetails')}
              </button>
            </div>
          </form>
          {!rsvpOpen && (
            <div className="feedback-banner" role="status">
              {t('rsvpClosedBanner')}
            </div>
          )}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={openFullReport}>
              {t('openEventReport')}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={openOrderSheet}>
              {t('openOrderSheet')}
            </button>
          </div>
        </section>
      )}

      {setupReadyToInvite &&
        activePhase === 'setup' &&
        !shareDone &&
        !guided &&
        canManage && (
          <div className="sticky-invite-cta" role="region" aria-label={t('nextInviteFriends')}>
            <p>{t('inviteWhenMenuReady')}</p>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setPhase('invite')}
            >
              {t('nextInviteFriends')}
            </button>
          </div>
        )}

      {coachStep && canManage && (
        <FirstEventCoach
          step={coachStep}
          onStep={setCoachStep}
          onFinish={() => {
            markAssistedComplete()
            setCoachStep(null)
            setSearchParams({}, { replace: true })
          }}
        />
      )}
    </>
  )
}
