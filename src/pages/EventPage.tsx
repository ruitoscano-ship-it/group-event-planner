import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import {
  attendeeTotal,
  attendeeUnitPrice,
  compressImageFile,
  formatDate,
  formatMoney,
  gatheringTotals,
  menuLabel,
  partySize,
  selectionHasAlaCarte,
} from '../lib/money'
import { useGatherings } from '../store/GatheringsContext'

type Tab = 'menu' | 'guests' | 'payments'

export function EventPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const { t, localeTag } = useI18n()
  const {
    getGathering,
    ensureGathering,
    loading,
    deleteGathering,
    addMenuItem,
    setMenuCard,
    removeMenuItem,
    addAttendee,
    updateAttendee,
    removeAttendee,
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
    groupSize: 2,
    menuItemIds: [] as string[],
    allergies: '',
    notes: '',
  })
  const [guestBusy, setGuestBusy] = useState(false)
  const [guestMsg, setGuestMsg] = useState<string | null>(null)

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

  const totals = useMemo(
    () => (gathering ? gatheringTotals(gathering) : null),
    [gathering],
  )

  const guestEstimate = useMemo(() => {
    if (!gathering) return 0
    const fake = {
      id: '',
      name: '',
      registeredBy: '',
      menuItemIds: guestForm.menuItemIds,
      allergies: '',
      notes: '',
      amountPaid: 0,
      createdAt: '',
      isGroup: guestForm.asGroup,
      groupSize: guestForm.asGroup ? guestForm.groupSize : 1,
    }
    return attendeeUnitPrice(fake, gathering.menu) * partySize(fake)
  }, [gathering, guestForm])

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
      setCardMsg(t('menuCardSaved'))
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
      setCardMsg(t('menuCardSaved'))
    } catch (err) {
      setCardMsg(err instanceof Error ? err.message : t('menuCardUploading'))
    } finally {
      setCardBusy(false)
    }
  }

  function toggleGuestMenu(id: string) {
    if (!gathering) return
    const item = gathering.menu.find((m) => m.id === id)
    if (!item) return
    setGuestForm((prev) => {
      const selected = prev.menuItemIds.includes(id)
      if (selected) {
        return { ...prev, menuItemIds: prev.menuItemIds.filter((x) => x !== id) }
      }
      if (item.isAlaCarte) {
        return { ...prev, menuItemIds: [id] }
      }
      const withoutAla = prev.menuItemIds.filter(
        (x) => !gathering.menu.find((m) => m.id === x)?.isAlaCarte,
      )
      return { ...prev, menuItemIds: [...withoutAla, id] }
    })
  }

  async function onAddGuest(e: FormEvent) {
    e.preventDefault()
    if (!gathering || !guestForm.name.trim() || guestBusy) return
    setGuestBusy(true)
    setGuestMsg(null)
    try {
      await addAttendee(gathering.id, {
        name: guestForm.name.trim(),
        registeredBy: t('registeredByOrganizer'),
        menuItemIds: guestForm.menuItemIds,
        allergies: guestForm.allergies.trim(),
        notes: guestForm.notes.trim(),
        isGroup: guestForm.asGroup,
        groupSize: guestForm.asGroup ? Math.max(1, guestForm.groupSize) : 1,
      })
      setGuestForm({
        name: '',
        asGroup: false,
        groupSize: 2,
        menuItemIds: [],
        allergies: '',
        notes: '',
      })
      setGuestMsg(t('guestAdded'))
    } catch (err) {
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
          <Link viewTransition className="btn btn-ghost" to={`/rsvp/${gathering.id}`}>
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
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(label)}
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
            {cardMsg && <p className="sub" style={{ marginTop: '0.75rem' }}>{cardMsg}</p>}
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
                  <label className="full paid-toggle" style={{ flexDirection: 'row', alignItems: 'center' }}>
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
            {guestMsg && <p className="sub">{guestMsg}</p>}
            <form onSubmit={(e) => void onAddGuest(e)}>
              <div className="form-grid">
                <label className="full">
                  {guestForm.asGroup ? t('groupName') : t('guestName')}
                  <input
                    required
                    value={guestForm.name}
                    onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                    placeholder={guestForm.asGroup ? t('groupNamePlaceholder') : 'Alex'}
                  />
                </label>
                <label className="full paid-toggle" style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={guestForm.asGroup}
                    onChange={(e) =>
                      setGuestForm({ ...guestForm, asGroup: e.target.checked })
                    }
                  />
                  {t('registeringAsGroup')}
                </label>
                {guestForm.asGroup && (
                  <label>
                    {t('groupSize')}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={guestForm.groupSize}
                      onChange={(e) =>
                        setGuestForm({
                          ...guestForm,
                          groupSize: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                )}
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
                <label className="full">
                  {t('notes')}
                  <textarea
                    value={guestForm.notes}
                    onChange={(e) => setGuestForm({ ...guestForm, notes: e.target.value })}
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
                    const selected = guestForm.menuItemIds.includes(item.id)
                    return (
                      <label
                        key={item.id}
                        className={`menu-option ${selected ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGuestMenu(item.id)}
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
                  {t('estimated')}{' '}
                  <span className="price">
                    {formatMoney(guestEstimate, gathering.currency, localeTag)}
                  </span>
                </strong>
                <button className="btn btn-accent" type="submit" disabled={guestBusy}>
                  {guestBusy ? t('saving') : t('addGuest')}
                </button>
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
                {gathering.attendees.map((a) => {
                  const owed = attendeeTotal(a, gathering.menu)
                  const variable = selectionHasAlaCarte(a, gathering.menu)
                  return (
                    <div key={a.id} className="guest-row">
                      <div>
                        <h4>{a.name}</h4>
                        <p>
                          {t('registeredBy', { name: a.registeredBy })}
                          {a.registeredBy !== a.name ? ` ${t('forSomeoneElse')}` : ''}
                        </p>
                        <div className="guest-meta">
                          {a.isGroup && (
                            <span className="chip chip-warm">
                              {t('groupBadge', { count: partySize(a) })}
                            </span>
                          )}
                          <span className="chip">
                            {menuLabel(a.menuItemIds, gathering.menu, t('noSelection'))}
                          </span>
                          <span className="chip chip-warm">
                            {formatMoney(owed, gathering.currency, localeTag)}
                            {variable ? ' +' : ''}
                          </span>
                          {variable && (
                            <span className="chip chip-muted">{t('alaCarte')}</span>
                          )}
                          {a.allergies && (
                            <span className="chip chip-allergy">
                              {t('allergy', { value: a.allergies })}
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
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
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
                        {menuLabel(a.menuItemIds, gathering.menu, t('noSelection'))}
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
