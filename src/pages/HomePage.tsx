import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CreateEventChat } from '../components/CreateEventChat'
import { InviteCard } from '../components/InviteCard'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import { authApi } from '../lib/authApi'
import { formatDate } from '../lib/money'
import { loadKnownIds } from '../lib/knownIds'
import { formatOrganizerCode, loadOrganizerCode } from '../lib/organizerAccess'
import { useGatherings } from '../store/GatheringsContext'
import { useOrganizerAuth } from '../store/OrganizerAuthContext'
import type { GatheringInput } from '../types'

type Mode = 'choose' | 'create' | 'code'

const DEMO_INVITE = {
  title: '',
  type: 'lunch' as const,
  date: '2026-10-03',
  time: '13:00',
  location: '',
  notes: '',
  organizerName: '',
  menu: [
    {
      id: 'demo',
      name: 'Menu',
      description: '',
      price: 18,
      category: '',
      isAlaCarte: false,
    },
  ],
  carteItems: [],
  carteApproved: false,
  menuCardUrl: '',
}

export function HomePage() {
  const { createGathering, unlockWithCode, gatherings, loading } = useGatherings()
  const {
    user,
    myGatherings,
    authConfigured,
    loading: authLoading,
    logout,
    refreshAuth,
    ownsGathering,
  } = useOrganizerAuth()
  const { t, localeTag } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('choose')
  const [accessCode, setAccessCode] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [claimBusyId, setClaimBusyId] = useState<string | null>(null)
  const [authBanner, setAuthBanner] = useState<string | null>(null)
  const [heroReady, setHeroReady] = useState(false)
  const heroRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    document.body.dataset.page = 'home'
    return () => {
      delete document.body.dataset.page
    }
  }, [])

  useEffect(() => {
    const img = heroRef.current
    if (img?.complete && img.naturalWidth > 0) setHeroReady(true)
  }, [])

  useEffect(() => {
    const signedIn = searchParams.get('signedIn')
    const authError = searchParams.get('authError')
    if (signedIn) {
      setAuthBanner(t('authSignedInBanner'))
      void refreshAuth()
      setSearchParams({}, { replace: true })
    } else if (authError) {
      setAuthBanner(authError)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, refreshAuth, t])

  const deviceOnlyEvents = useMemo(() => {
    const owned = new Set(myGatherings.map((g) => g.id))
    const known = loadKnownIds()
    return gatherings.filter(
      (g) => known.includes(g.id) && loadOrganizerCode(g.id) && !owned.has(g.id),
    )
  }, [gatherings, myGatherings])

  const demoGathering = useMemo(
    () => ({
      ...DEMO_INVITE,
      title: t('homeGlimpseMockTitle'),
      location: t('homeGlimpseMockLocation'),
      organizerName: t('homeGlimpseMockHost'),
      notes: t('homeGlimpseMockNotes'),
    }),
    [t],
  )

  function goHome() {
    setMode('choose')
    setAccessError(null)
    setAccessCode('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreate(input: GatheringInput) {
    const created = await createGathering(input)
    await refreshAuth()
    navigate(`/events/${created.gathering.id}?created=1`, { viewTransition: true })
  }

  async function onAccess(e: FormEvent) {
    e.preventDefault()
    if (!accessCode.trim() || accessBusy) return
    setAccessBusy(true)
    setAccessError(null)
    try {
      const result = await unlockWithCode(accessCode.trim())
      setAccessCode('')
      await refreshAuth()
      navigate(`/events/${result.gathering.id}`, { viewTransition: true })
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : t('accessCodeFailed'))
    } finally {
      setAccessBusy(false)
    }
  }

  async function claimDeviceEvent(gatheringId: string) {
    const code = loadOrganizerCode(gatheringId)
    if (!code || claimBusyId) return
    setClaimBusyId(gatheringId)
    try {
      await authApi.claimGathering(gatheringId, code)
      await refreshAuth()
    } catch (err) {
      setAuthBanner(err instanceof Error ? err.message : t('authClaimFailed'))
    } finally {
      setClaimBusyId(null)
    }
  }

  function startCreate() {
    setMode('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startCode() {
    setMode('code')
    setAccessError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <header className="topbar topbar-home">
        <Link
          viewTransition
          to="/"
          className="brand brand-mark-only"
          onClick={() => goHome()}
          aria-label="Round"
        >
          <i className="brand-mark" aria-hidden />
        </Link>
        <div className="nav-actions">
          <LanguageSwitcher />
          {user ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => void logout()}>
              {t('authSignOut')}
            </button>
          ) : null}
        </div>
      </header>

      {authBanner && (
        <div className="feedback-banner status-banner home-auth-banner" role="status">
          {authBanner}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAuthBanner(null)}
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      <section className="landing">
        <div className="landing-visual" role="img" aria-label={t('brandAria')}>
          <img
            ref={heroRef}
            className={`landing-visual-img${heroReady ? ' is-ready' : ''}`}
            src="/landing-hero.jpg"
            alt=""
            width={864}
            height={1152}
            decoding="async"
            fetchPriority="high"
            onLoad={() => setHeroReady(true)}
          />
        </div>
        <div className="landing-copy">
          <h1 className="brand landing-brand">
            Round<span>.</span>
          </h1>
          <p className="hero-lede">{t('heroLede')}</p>

          {user && (
            <p className="sub auth-user-line">
              {t('authSignedInAs', { name: user.name || user.email })}
            </p>
          )}

          {mode === 'choose' && (
            <div className="landing-actions">
              <button
                className="btn btn-accent landing-action"
                type="button"
                onClick={() => setMode('create')}
              >
                {t('createEvent')}
              </button>
              {authConfigured && !user && !authLoading && (
                <a className="btn btn-ghost landing-action" href={authApi.googleStartUrl}>
                  {t('authSignInGoogle')}
                </a>
              )}
              <button
                className="btn btn-ghost landing-action"
                type="button"
                onClick={() => {
                  setMode('code')
                  setAccessError(null)
                }}
              >
                {t('findMyEvent')}
              </button>
            </div>
          )}

          {mode === 'create' && (
            <CreateEventChat onCancel={goHome} onCreate={handleCreate} />
          )}

          {mode === 'code' && (
            <section className="landing-panel">
              <div className="landing-panel-head">
                <div>
                  <h2>{t('findMyEvent')}</h2>
                  <p className="sub">
                    {user ? t('findMyEventSignedInSub') : t('findMyEventSub')}
                  </p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={goHome}>
                  {t('dismiss')}
                </button>
              </div>
              {accessError && <p className="allergy">{accessError}</p>}
              <form onSubmit={(e) => void onAccess(e)}>
                <label className="full">
                  {t('organizerCode')}
                  <input
                    value={accessCode}
                    onChange={(e) => setAccessCode(formatOrganizerCode(e.target.value))}
                    placeholder={t('organizerCodePlaceholder')}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </label>
                <div className="form-actions">
                  <button className="btn btn-accent" type="submit" disabled={accessBusy}>
                    {accessBusy ? t('saving') : t('openWithCode')}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </section>

      <div className="home-body">
        {mode === 'choose' && user && (
          <section className="panel home-my-events" aria-labelledby="home-my-events-title">
            <h2 id="home-my-events-title">{t('authMyEvents')}</h2>
            <p className="sub">{t('authMyEventsSub')}</p>
            {authLoading || loading ? (
              <div className="empty">{t('loadingGathering')}</div>
            ) : myGatherings.length === 0 ? (
              <div className="empty empty-with-cta">
                <p>{t('authMyEventsEmpty')}</p>
                <button type="button" className="btn btn-accent" onClick={startCreate}>
                  {t('createEvent')}
                </button>
              </div>
            ) : (
              <div className="home-event-list">
                {myGatherings.map((g) => (
                  <Link
                    key={g.id}
                    viewTransition
                    className="home-event-card"
                    to={`/events/${g.id}`}
                  >
                    <strong>{g.title}</strong>
                    <span>
                      {formatDate(g.date, localeTag, t('dateTbd'))}
                      {g.time ? ` · ${g.time}` : ''}
                    </span>
                    <span>{g.location || t('locationTbd')}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {mode === 'choose' && user && deviceOnlyEvents.length > 0 && (
          <section
            className="panel home-device-events"
            aria-labelledby="home-device-events-title"
          >
            <h2 id="home-device-events-title">{t('authDeviceEvents')}</h2>
            <p className="sub">{t('authDeviceEventsSub')}</p>
            <div className="home-event-list">
              {deviceOnlyEvents.map((g) => (
                <div key={g.id} className="home-event-card home-event-card-row">
                  <div>
                    <strong>{g.title}</strong>
                    <span>
                      {formatDate(g.date, localeTag, t('dateTbd'))}
                      {g.time ? ` · ${g.time}` : ''}
                    </span>
                  </div>
                  <div className="row-actions">
                    <Link
                      viewTransition
                      className="btn btn-ghost btn-sm"
                      to={`/events/${g.id}`}
                    >
                      {t('openWithCode')}
                    </Link>
                    {!ownsGathering(g.id) && (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        disabled={claimBusyId === g.id}
                        onClick={() => void claimDeviceEvent(g.id)}
                      >
                        {claimBusyId === g.id ? t('saving') : t('authAddToAccount')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {mode === 'choose' && !user && (
          <>
            <section className="home-flow" aria-labelledby="home-flow-title">
              <h2 id="home-flow-title">{t('homeFlowTitle')}</h2>
              <p className="home-section-lede">{t('homeFlowLede')}</p>
              <ol className="home-flow-steps">
                <li>
                  <span className="home-flow-num" aria-hidden>
                    1
                  </span>
                  <div>
                    <h3>{t('homeFlowStep1Title')}</h3>
                    <p>{t('homeFlowStep1Body')}</p>
                  </div>
                </li>
                <li>
                  <span className="home-flow-num" aria-hidden>
                    2
                  </span>
                  <div>
                    <h3>{t('homeFlowStep2Title')}</h3>
                    <p>{t('homeFlowStep2Body')}</p>
                  </div>
                </li>
                <li>
                  <span className="home-flow-num" aria-hidden>
                    3
                  </span>
                  <div>
                    <h3>{t('homeFlowStep3Title')}</h3>
                    <p>{t('homeFlowStep3Body')}</p>
                  </div>
                </li>
              </ol>
            </section>

            <section className="home-glimpse" aria-labelledby="home-glimpse-title">
              <div className="home-glimpse-copy">
                <h2 id="home-glimpse-title">{t('homeGlimpseTitle')}</h2>
                <p className="home-section-lede">{t('homeGlimpseLede')}</p>
              </div>
              <div className="home-glimpse-stage">
                <InviteCard
                  gathering={demoGathering}
                  compact
                  footer={t('alreadyComing', { count: 2 })}
                  className="home-glimpse-invite"
                />
              </div>
            </section>

            <section className="home-about" aria-labelledby="home-about-title">
              <h2 id="home-about-title">{t('homeAboutTitle')}</h2>
              <p className="home-section-lede">{t('homeAboutLede')}</p>
              <div className="home-about-grid">
                <article>
                  <h3>{t('homeAboutMenuTitle')}</h3>
                  <p>{t('homeAboutMenuBody')}</p>
                </article>
                <article>
                  <h3>{t('homeAboutRsvpTitle')}</h3>
                  <p>{t('homeAboutRsvpBody')}</p>
                </article>
                <article>
                  <h3>{t('homeAboutMoneyTitle')}</h3>
                  <p>{t('homeAboutMoneyBody')}</p>
                </article>
              </div>
            </section>

            <section className="home-close" aria-labelledby="home-close-title">
              <h2 id="home-close-title">{t('homeCloseTitle')}</h2>
              <p className="home-section-lede">{t('homeCloseLede')}</p>
              <div className="home-close-actions">
                <button className="btn btn-accent" type="button" onClick={startCreate}>
                  {t('createEvent')}
                </button>
                {authConfigured && (
                  <a className="btn btn-ghost" href={authApi.googleStartUrl}>
                    {t('authSignInGoogle')}
                  </a>
                )}
                <button className="btn btn-ghost" type="button" onClick={startCode}>
                  {t('findMyEvent')}
                </button>
              </div>
            </section>
          </>
        )}

        <footer className="site-footer">
          <div className="site-footer-main">
            <div className="site-footer-brand">
              <strong>
                Round<span>.</span>
              </strong>
              <p>{t('footerTagline')}</p>
            </div>
            <nav className="site-footer-nav" aria-label={t('footerNavLabel')}>
              <details className="site-footer-disclosure">
                <summary>{t('footerPrivacyTitle')}</summary>
                <p>{t('footerPrivacyBody')}</p>
              </details>
              <details className="site-footer-disclosure">
                <summary>{t('footerDisclaimerTitle')}</summary>
                <p>{t('footerDisclaimerBody')}</p>
              </details>
              <details className="site-footer-disclosure">
                <summary>{t('footerTermsTitle')}</summary>
                <p>{t('footerTermsBody')}</p>
              </details>
            </nav>
          </div>
          <p className="site-footer-copy">
            {t('footerCopyright', { year: new Date().getFullYear() })}
          </p>
        </footer>
      </div>
    </>
  )
}
