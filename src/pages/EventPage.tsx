import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GuestEditor } from '../components/GuestEditor'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { MenuPicker } from '../components/MenuPicker'
import { useI18n } from '../i18n/I18nContext'
import {
  attendeeTotal,
  compressImageFile,
  createMemberDraft,
  formatDate,
  formatMoney,
  gatheringTotals,
  idsHaveAlaCarte,
  menuLabel,
  partySize,
  selectionHasAlaCarte,
  toggleMenuSelection,
  unitPriceForIds,
} from '../lib/money'
import {
  detailsSavedKeys,
  guestAddedKeys,
  menuCardSavedKeys,
  menuItemSavedKeys,
  pickFeedback,
} from '../lib/feedback'
import { useGatherings } from '../store/GatheringsContext'
import type { GroupMember } from '../types'

type Tab = 'menu' | 'guests' | 'payments' | 'inbox'

export function EventPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const { t, localeTag } = useI18n()
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
  } = useGatherings()
  const gathering = getGathering(eventId)
  const [fetching, setFetching] = useState(!gathering)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('menu')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cardLink, setCardLink] = useState('')
  const [cardBusy, setCardBusy] = useState(false)
  const [cardMsg, setCardMsg] = useState<string | null>(null)
  const [detailsForm, setDetailsForm] = useState({
    date: '',
    time: '',
    location: '',
    organizerName: '',
    organizerEmail: '',
    organizerPhone: '',
  })
  const [detailsBusy, setDetailsBusy] = useState(false)
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState(false)
  const [menuMsg, setMenuMsg] = useState<string | null>(null)
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    isAlaCarte: false,
  })
  const [guestForm, setGuestForm] = useState({
    name: '',
    asGroup: false,
    menuItemIds: [] as string[],
    allergies: '',
    email: '',
    phone: '',
    notes: '',
    menuRequest: '',
  })
  const [guestMembers, setGuestMembers] = useState<GroupMember[]>(() => [
    createMemberDraft(),
    createMemberDraft(),
  ])
  const [guestBusy, setGuestBusy] = useState(false)
  const [guestMsg, setGuestMsg] = useState<string | null>(null)
  const [guestError, setGuestError] = useState(false)

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
      setCardLink(gathering.menuCardUrl)
    }
  }, [gathering?.menuCardUrl])

  useEffect(() => {
    if (!gathering) return
    setDetailsForm({
      date: gathering.date || '',
      time: gathering.time || '',
      location: gathering.location || '',
      organizerName: gathering.organizerName || '',
      organizerEmail: gathering.organizerEmail || '',
      organizerPhone: gathering.organizerPhone || '',
    })
  }, [
    gathering?.id,
    gathering?.date,
    gathering?.time,
    gathering?.location,
    gathering?.organizerName,
    gathering?.organizerEmail,
    gathering?.organizerPhone,
  ])

  const totals = useMemo(
    () => (gathering ? gatheringTotals(gathering) : null),
    [gathering],
  )

  const guestEstimate = useMemo(() => {
    if (!gathering) return 0
    if (guestForm.asGroup) {
      return guestMembers.reduce(
        (sum, m) => sum + unitPriceForIds(m.menuItemIds, gathering.menu),
        0,
      )
    }
    return unitPriceForIds(guestForm.menuItemIds, gathering.menu)
  }, [gathering, guestForm, guestMembers])

  const guestHasAlaCarte = useMemo(() => {
    if (!gathering) return false
    if (guestForm.asGroup) {
      return guestMembers.some((m) => idsHaveAlaCarte(m.menuItemIds, gathering.menu))
    }
    return idsHaveAlaCarte(guestForm.menuItemIds, gathering.menu)
  }, [gathering, guestForm, guestMembers])

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

  const rsvpUrl = `${window.location.origin}/rsvp/${gathering.id}`
  const typeLabel =
    gathering.type === 'lunch'
      ? t('typeLunch')
      : gathering.type === 'dinner'
        ? t('typeDinner')
        : gathering.type === 'brunch'
          ? t('typeBrunch')
          : t('typeOther')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!gathering || detailsBusy) return
    setDetailsBusy(true)
    setDetailsMsg(null)
    setDetailsError(false)
    try {
      await updateGathering(gathering.id, {
        date: detailsForm.date,
        time: detailsForm.time,
        location: detailsForm.location.trim(),
        organizerName: detailsForm.organizerName.trim(),
        organizerEmail: detailsForm.organizerEmail.trim(),
        organizerPhone: detailsForm.organizerPhone.trim(),
      })
      setDetailsMsg(pickFeedback(t, [...detailsSavedKeys]))
    } catch (err) {
      setDetailsError(true)
      setDetailsMsg(err instanceof Error ? err.message : t('detailsSaveFailed'))
    } finally {
      setDetailsBusy(false)
    }
  }

  async function onAddMenu(e: FormEvent) {
    e.preventDefault()
    if (!gathering) return
    const price = Number(menuForm.price)
    if (!menuForm.name.trim() || busy) return
    if (!menuForm.isAlaCarte && (Number.isNaN(price) || price < 0)) return
    setBusy(true)
    try {
      await addMenuItem(gathering.id, {
        name: menuForm.name.trim(),
        description: menuForm.description.trim(),
        price: menuForm.isAlaCarte ? 0 : price,
        category: menuForm.category.trim() || t('placeholderCategory'),
        isAlaCarte: menuForm.isAlaCarte,
      })
      setMenuForm({
        name: '',
        description: '',
        price: '',
        category: '',
        isAlaCarte: false,
      })
      setMenuMsg(pickFeedback(t, [...menuItemSavedKeys]))
    } finally {
      setBusy(false)
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

  function updateGuestMember(id: string, patch: Partial<GroupMember>) {
    setGuestMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function toggleGuestMemberMenu(memberId: string, itemId: string) {
    if (!gathering) return
    setGuestMembers((prev) =>
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

  async function onAddGuest(e: FormEvent) {
    e.preventDefault()
    if (!gathering || !guestForm.name.trim() || guestBusy) return

    if (guestForm.asGroup) {
      if (guestMembers.length === 0) {
        setGuestMsg(t('needMembers'))
        setGuestError(true)
        return
      }
      const incomplete = guestMembers.some((m) => {
        if (!m.name.trim()) return true
        if (gathering.menu.length === 0) return false
        return m.menuItemIds.length === 0 && !m.menuRequest.trim()
      })
      if (incomplete) {
        setGuestMsg(t('needMemberMenus'))
        setGuestError(true)
        return
      }
    }

    setGuestBusy(true)
    setGuestMsg(null)
    setGuestError(false)
    try {
      await addAttendee(gathering.id, {
        name: guestForm.name.trim(),
        registeredBy: t('registeredByOrganizer'),
        email: guestForm.email.trim(),
        phone: guestForm.phone.trim(),
        menuItemIds: guestForm.asGroup ? [] : guestForm.menuItemIds,
        allergies: guestForm.asGroup ? '' : guestForm.allergies.trim(),
        notes: guestForm.notes.trim(),
        menuRequest: guestForm.asGroup ? '' : guestForm.menuRequest.trim(),
        isGroup: guestForm.asGroup,
        groupSize: guestForm.asGroup ? guestMembers.length : 1,
        members: guestForm.asGroup
          ? guestMembers.map((m) => ({
              ...m,
              name: m.name.trim(),
              allergies: m.allergies.trim(),
              menuRequest: m.menuRequest.trim(),
            }))
          : [],
      })
      setGuestForm({
        name: '',
        asGroup: false,
        menuItemIds: [],
        allergies: '',
        email: '',
        phone: '',
        notes: '',
        menuRequest: '',
      })
      setGuestMembers([createMemberDraft(), createMemberDraft()])
      setGuestMsg(pickFeedback(t, [...guestAddedKeys]))
    } catch (err) {
      setGuestError(true)
      setGuestMsg(err instanceof Error ? err.message : t('guestAdded'))
    } finally {
      setGuestBusy(false)
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
          <Link viewTransition className="btn btn-ghost btn-sm hide-on-narrow" to={`/rsvp/${gathering.id}`}>
            {t('openRsvp')}
          </Link>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            onClick={() => {
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
          <h1>{gathering.title}</h1>
          <p className="lede">
            {gathering.location || t('locationTbd')}
            {gathering.notes ? ` — ${gathering.notes}` : ''}
          </p>
          {totals.hasVariable && <p className="lede">{t('hasVariableNote')}</p>}
        </div>
      </div>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>{t('editDetails')}</h2>
        <p className="sub">{t('editDetailsSub')}</p>
        {detailsMsg && (
          <div
            className={`feedback-banner ${detailsError ? 'error' : ''}`}
            role="status"
          >
            {detailsMsg}
          </div>
        )}
        <form onSubmit={(e) => void onSaveDetails(e)}>
          <div className="form-grid">
            <label>
              {t('date')}
              <input
                type="date"
                value={detailsForm.date}
                onChange={(e) => setDetailsForm({ ...detailsForm, date: e.target.value })}
              />
            </label>
            <label>
              {t('time')}
              <input
                type="time"
                value={detailsForm.time}
                onChange={(e) => setDetailsForm({ ...detailsForm, time: e.target.value })}
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
          </div>
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={detailsBusy}>
              {detailsBusy ? t('saving') : t('saveDetails')}
            </button>
          </div>
        </form>
      </section>

      <div className="summary-strip">
        <div className="summary-tile">
          <span>{t('guests')}</span>
          <strong>{totals.guestCount}</strong>
        </div>
        <div className="summary-tile">
          <span>{t('menuTotal')}</span>
          <strong>{formatMoney(totals.owed, gathering.currency, localeTag)}</strong>
        </div>
        <div className="summary-tile">
          <span>{t('collected')}</span>
          <strong>{formatMoney(totals.paid, gathering.currency, localeTag)}</strong>
        </div>
        <div className="summary-tile">
          <span>{t('stillDue')}</span>
          <strong>{formatMoney(totals.outstanding, gathering.currency, localeTag)}</strong>
        </div>
      </div>

      <div className="share-box">
        <strong>{t('selfServiceLink')}</strong>
        <code>{rsvpUrl}</code>
        <button className="btn btn-sm btn-accent" type="button" onClick={() => void copyLink()}>
          {copied ? t('copied') : t('copyLink')}
        </button>
      </div>

      <div className="tabs">
        {([
          ['menu', 'tabMenu'],
          ['guests', 'tabGuests'],
          ['payments', 'tabPayments'],
          ['inbox', 'tabInbox'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(label)}
            {key === 'inbox' &&
              (gathering.messages || []).some((m) => !m.read) && (
                <span className="tab-badge">
                  {(gathering.messages || []).filter((m) => !m.read).length}
                </span>
              )}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <>
          <section className="panel" style={{ marginBottom: '1rem' }}>
            <h2>{t('menuCard')}</h2>
            <p className="sub">{t('menuCardSub')}</p>
            <div className="form-grid">
              <label className="full">
                {t('menuCardLink')}
                <input
                  value={cardLink}
                  onChange={(e) => setCardLink(e.target.value)}
                  placeholder={t('menuCardLinkPlaceholder')}
                />
              </label>
              <label className="full">
                {t('menuCardUpload')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onUploadCard(e.target.files?.[0] ?? null)}
                  disabled={cardBusy}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-accent"
                type="button"
                disabled={cardBusy}
                onClick={() => void saveCardLink()}
              >
                {cardBusy ? t('menuCardUploading') : t('menuCardSave')}
              </button>
              {gathering.menuCardUrl && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => void setMenuCard(gathering.id, '')}
                >
                  {t('menuCardClear')}
                </button>
              )}
            </div>
            {cardMsg && (
              <div className="feedback-banner" role="status" style={{ marginTop: '0.75rem' }}>
                {cardMsg}
              </div>
            )}
            {gathering.menuCardUrl && (
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
            )}
          </section>

          <div className="layout-split">
            <section className="panel">
              <h2>{t('addMenuOption')}</h2>
              <p className="sub">{t('addMenuSub')}</p>
              {menuMsg && (
                <div className="feedback-banner" role="status">
                  {menuMsg}
                </div>
              )}
              <form onSubmit={(e) => void onAddMenu(e)}>
                <div className="form-grid">
                  <label className="full">
                    {t('name')}
                    <input
                      required
                      value={menuForm.name}
                      onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                      placeholder={t('placeholderDish')}
                    />
                  </label>
                  <label>
                    {t('category')}
                    <input
                      value={menuForm.category}
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, category: e.target.value })
                      }
                      placeholder={t('placeholderCategory')}
                    />
                  </label>
                  <label>
                    {t('price')} ({gathering.currency})
                    <input
                      required={!menuForm.isAlaCarte}
                      disabled={menuForm.isAlaCarte}
                      type="number"
                      min="0"
                      step="0.01"
                      value={menuForm.isAlaCarte ? '' : menuForm.price}
                      onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                      placeholder={menuForm.isAlaCarte ? '—' : '12.50'}
                    />
                  </label>
                  <label className="full paid-toggle">
                    <input
                      type="checkbox"
                      checked={menuForm.isAlaCarte}
                      onChange={(e) =>
                        setMenuForm({
                          ...menuForm,
                          isAlaCarte: e.target.checked,
                          price: e.target.checked ? '' : menuForm.price,
                        })
                      }
                    />
                    {t('alaCarte')} — {t('alaCarteHint')}
                  </label>
                  <label className="full">
                    {t('description')}
                    <textarea
                      value={menuForm.description}
                      onChange={(e) =>
                        setMenuForm({ ...menuForm, description: e.target.value })
                      }
                      placeholder={t('placeholderDishDesc')}
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="btn btn-accent" type="submit" disabled={busy}>
                    {busy ? t('adding') : t('addToMenu')}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <h2>{t('currentMenu')}</h2>
              <p className="sub">{t('optionsAvailable', { count: gathering.menu.length })}</p>
              {gathering.menu.length === 0 ? (
                <div className="empty">{t('addOptionBeforeShare')}</div>
              ) : (
                <div className="menu-list">
                  {gathering.menu.map((item) => (
                    <div key={item.id} className="menu-row">
                      <div>
                        <span className="chip chip-muted">{item.category}</span>
                        {item.isAlaCarte && (
                          <span className="chip chip-warm" style={{ marginLeft: '0.35rem' }}>
                            {t('alaCarte')}
                          </span>
                        )}
                        <h4>{item.name}</h4>
                        {item.description && <p>{item.description}</p>}
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
        </>
      )}

      {tab === 'guests' && (
        <div className="layout-split">
          <section className="panel">
            <h2>{t('organizerRegister')}</h2>
            <p className="sub">{t('organizerRegisterSub')}</p>
            {guestMsg && (
              <div
                className={`feedback-banner ${guestError ? 'error' : ''}`}
                role="status"
              >
                {guestMsg}
              </div>
            )}
            <form onSubmit={(e) => void onAddGuest(e)}>
              <div className="form-grid">
                <label className="full">
                  {guestForm.asGroup ? t('groupName') : t('guestName')}
                  <input
                    required
                    autoComplete="name"
                    value={guestForm.name}
                    onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                    placeholder={guestForm.asGroup ? t('groupNamePlaceholder') : 'Alex'}
                  />
                </label>
                <label className="full paid-toggle">
                  <input
                    type="checkbox"
                    checked={guestForm.asGroup}
                    onChange={(e) => {
                      const next = e.target.checked
                      setGuestForm({ ...guestForm, asGroup: next })
                      if (next && guestMembers.length === 0) {
                        setGuestMembers([createMemberDraft(), createMemberDraft()])
                      }
                    }}
                  />
                  {t('registeringAsGroup')}
                </label>
                {!guestForm.asGroup && (
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
                )}
                <label>
                  {t('emailOptional')}
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={guestForm.email}
                    onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                    placeholder={t('placeholderEmail')}
                  />
                </label>
                <label>
                  {t('phoneOptional')}
                  <input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                    placeholder={t('placeholderPhone')}
                  />
                </label>
                <label className="full">
                  {t('notes')}
                  <textarea
                    value={guestForm.notes}
                    onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })}
                    placeholder={t('placeholderGuestNotes')}
                  />
                </label>
              </div>

              {guestForm.asGroup ? (
                <>
                  <h3 style={{ margin: '1.25rem 0 0.35rem', fontFamily: 'var(--font-display)' }}>
                    {t('groupMembersTitle')}
                  </h3>
                  <p className="sub">{t('groupMembersSub')}</p>
                  <div className="member-list">
                    {guestMembers.map((member, index) => (
                      <div key={member.id} className="member-card">
                        <div className="member-card-head">
                          <h4>{t('memberLabel', { n: index + 1 })}</h4>
                          {guestMembers.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                setGuestMembers((prev) =>
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
                              updateGuestMember(member.id, { name: e.target.value })
                            }
                            placeholder={t('memberNamePlaceholder')}
                            autoComplete="name"
                          />
                        </label>
                        <label>
                          {t('allergiesDietary')}
                          <input
                            value={member.allergies}
                            onChange={(e) =>
                              updateGuestMember(member.id, { allergies: e.target.value })
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
                            onToggle={(itemId) => toggleGuestMemberMenu(member.id, itemId)}
                            emptyLabel={t('organizerNoMenu')}
                          />
                        </div>
                        {gathering.menuCardUrl && (
                          <label>
                            {t('menuRequest')}
                            <textarea
                              value={member.menuRequest}
                              onChange={(e) =>
                                updateGuestMember(member.id, {
                                  menuRequest: e.target.value,
                                })
                              }
                              placeholder={t('menuRequestPlaceholder')}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setGuestMembers((prev) => [...prev, createMemberDraft()])
                    }
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
                  {gathering.menuCardUrl && (
                    <label
                      className="full"
                      style={{ display: 'block', marginTop: '0.85rem' }}
                    >
                      {t('menuRequest')}
                      <textarea
                        value={guestForm.menuRequest}
                        onChange={(e) =>
                          setGuestForm({ ...guestForm, menuRequest: e.target.value })
                        }
                        placeholder={t('menuRequestPlaceholder')}
                      />
                    </label>
                  )}
                </>
              )}

              <div className="sticky-actions">
                <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                  <div className="estimate-block">
                    <span className="estimate-label">
                      {guestHasAlaCarte ? t('estimatedVariable') : t('estimated')}
                    </span>
                    <span className="estimate-value price">
                      {formatMoney(guestEstimate, gathering.currency, localeTag)}
                      {guestHasAlaCarte ? '+' : ''}
                    </span>
                    <span className="estimate-note">
                      {guestHasAlaCarte
                        ? t('estimatedNoteVariable')
                        : t('estimatedNote')}
                      {guestForm.asGroup
                        ? ` · ${guestMembers.length} ${
                            guestMembers.length === 1
                              ? t('personLabel')
                              : t('peopleLabel')
                          }`
                        : ''}
                    </span>
                  </div>
                  <button className="btn btn-accent" type="submit" disabled={guestBusy}>
                    {guestBusy ? t('saving') : t('addGuest')}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2>{t('whosComing')}</h2>
            <p className="sub">{t('whosComingSub')}</p>
            {gathering.attendees.length === 0 ? (
              <div className="empty">{t('noRsvpsYet')}</div>
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
          {gathering.attendees.length === 0 ? (
            <div className="empty">{t('noGuestsToBill')}</div>
          ) : (
            <div className="guest-list">
              {gathering.attendees.map((a) => {
                const owed = attendeeTotal(a, gathering.menu)
                const remaining = Math.max(0, owed - a.amountPaid)
                const settled = remaining <= 0.001 && !selectionHasAlaCarte(a, gathering.menu)
                return (
                  <div key={a.id} className="guest-row">
                    <div>
                      <h4>{a.name}</h4>
                      <p>
                        {a.isGroup && a.members?.length
                          ? a.members
                              .map(
                                (m) =>
                                  `${m.name}: ${menuLabel(m.menuItemIds, gathering.menu, t('noSelection'))}`,
                              )
                              .join(' · ')
                          : menuLabel(a.menuItemIds, gathering.menu, t('noSelection'))}
                        {a.isGroup ? ` · ${t('groupBadge', { count: partySize(a) })}` : ''}
                      </p>
                      <div className="guest-meta">
                        <span className="chip chip-muted">
                          {t('owes', {
                            amount: formatMoney(owed, gathering.currency, localeTag),
                          })}
                        </span>
                        {selectionHasAlaCarte(a, gathering.menu) && (
                          <span className="chip chip-warm">{t('priceVariable')}</span>
                        )}
                        <span className={`chip ${settled ? '' : 'chip-warm'}`}>
                          {settled
                            ? t('paidInFull')
                            : t('dueAmount', {
                                amount: formatMoney(remaining, gathering.currency, localeTag),
                              })}
                        </span>
                      </div>
                      <div className="money-inputs">
                        <label>
                          {t('amountPaid')}
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
                            {t('markPaid')}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            type="button"
                            onClick={() =>
                              void updateAttendee(gathering.id, a.id, { amountPaid: 0 })
                            }
                          >
                            {t('reset')}
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
