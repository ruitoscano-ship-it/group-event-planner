import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CreateEventChat } from '../components/CreateEventChat'
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

  return (
    <>
      <header className="topbar">
        <Link
          viewTransition
          to="/"
          className="brand"
          onClick={() => goHome()}
        >
          <i className="brand-mark" aria-hidden />
          Round<span>.</span>
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
        <div className="feedback-banner" role="status" style={{ marginBottom: '1rem' }}>
          {authBanner}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setAuthBanner(null)}
          >
            {t('cancel')}
          </button>
        </div>
      )}

      <section className="landing">
        <div className="landing-visual" role="img" aria-label={t('brandAria')}>
          <img
            className="landing-visual-img"
            src="/landing-hero.jpg"
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="landing-copy">
          <p className="brand landing-brand">
            Round<span>.</span>
          </p>
          <p className="hero-lede">{t('heroLede')}</p>

          {user && (
            <p className="sub auth-user-line">
              {t('authSignedInAs', { name: user.name || user.email })}
            </p>
          )}

          {mode === 'choose' && (
            <div className="landing-actions">
              {authConfigured && !user && !authLoading && (
                <a className="btn btn-accent landing-action" href={authApi.googleStartUrl}>
                  {t('authSignInGoogle')}
                </a>
              )}
              <button
                className={`btn landing-action ${user || !authConfigured ? 'btn-accent' : 'btn-ghost'}`}
                type="button"
                onClick={() => setMode('create')}
              >
                {t('createEvent')}
              </button>
              <button
                className="btn btn-ghost landing-action"
                type="button"
                onClick={() => {
                  setMode('code')
                  setAccessError(null)
                }}
              >
                {t('enterOrganizerCode')}
              </button>
            </div>
          )}

          {mode === 'create' && (
            <CreateEventChat onCancel={goHome} onCreate={handleCreate} />
          )}

          {mode === 'code' && (
            <section className="landing-panel">
              <div className="landing-panel-head">
                <h2>{t('enterOrganizerCode')}</h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={goHome}
                >
                  {t('backToHome')}
                </button>
              </div>
              <p className="sub">
                {user ? t('accessWithCodeSignedInSub') : t('accessWithCodeSub')}
              </p>
              {accessError && <p className="allergy">{accessError}</p>}
              <form onSubmit={(e) => void onAccess(e)}>
                <label className="full">
                  {t('organizerCode')}
                  <input
                    value={accessCode}
                    onChange={(e) =>
                      setAccessCode(formatOrganizerCode(e.target.value))
                    }
                    placeholder={t('organizerCodePlaceholder')}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={goHome}
                  >
                    {t('backToHome')}
                  </button>
                  <button className="btn btn-accent" type="submit" disabled={accessBusy}>
                    {accessBusy ? t('saving') : t('openWithCode')}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </section>

      {mode === 'choose' && user && (
        <section className="panel home-my-events" aria-labelledby="home-my-events-title">
          <h2 id="home-my-events-title">{t('authMyEvents')}</h2>
          <p className="sub">{t('authMyEventsSub')}</p>
          {authLoading || loading ? (
            <div className="empty">{t('loadingGathering')}</div>
          ) : myGatherings.length === 0 ? (
            <div className="empty">{t('authMyEventsEmpty')}</div>
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
        <section className="panel home-device-events" aria-labelledby="home-device-events-title">
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
                  <Link viewTransition className="btn btn-ghost btn-sm" to={`/events/${g.id}`}>
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

      {mode === 'choose' && (
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
            <div className="home-glimpse-stage" aria-hidden>
              <div className="home-glimpse-window">
                <div className="home-glimpse-chrome">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="home-glimpse-body">
                  <p className="home-glimpse-kicker">{t('homeGlimpseMockKicker')}</p>
                  <p className="home-glimpse-event">{t('homeGlimpseMockTitle')}</p>
                  <p className="home-glimpse-meta">{t('homeGlimpseMockMeta')}</p>
                  <ul className="home-glimpse-guests">
                    <li>
                      <span>{t('homeGlimpseGuest1')}</span>
                      <em>{t('homeGlimpseGuest1Status')}</em>
                    </li>
                    <li>
                      <span>{t('homeGlimpseGuest2')}</span>
                      <em>{t('homeGlimpseGuest2Status')}</em>
                    </li>
                    <li>
                      <span>{t('homeGlimpseGuest3')}</span>
                      <em className="is-pending">{t('homeGlimpseGuest3Status')}</em>
                    </li>
                  </ul>
                  <div className="home-glimpse-link">
                    <span>{t('homeGlimpseMockLink')}</span>
                  </div>
                </div>
              </div>
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
              {authConfigured && !user && (
                <a className="btn btn-accent" href={authApi.googleStartUrl}>
                  {t('authSignInGoogle')}
                </a>
              )}
              <button
                className="btn btn-accent"
                type="button"
                onClick={() => {
                  setMode('create')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {t('createEvent')}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setMode('code')
                  setAccessError(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {t('enterOrganizerCode')}
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
    </>
  )
}
