import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreateEventChat } from '../components/CreateEventChat'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import { shouldUseAssistedMode } from '../lib/assistedMode'
import { formatOrganizerCode } from '../lib/organizerAccess'
import { useGatherings } from '../store/GatheringsContext'
import type { GatheringInput } from '../types'

type Mode = 'choose' | 'create' | 'code'

export function HomePage() {
  const { createGathering, unlockWithCode } = useGatherings()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('choose')
  const [accessCode, setAccessCode] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  function goHome() {
    setMode('choose')
    setAccessError(null)
    setAccessCode('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreate(input: GatheringInput) {
    const guideAfterCreate = shouldUseAssistedMode()
    const created = await createGathering(input)
    const q = guideAfterCreate ? 'created=1&assisted=1' : 'created=1'
    navigate(`/events/${created.gathering.id}?${q}`, { viewTransition: true })
  }

  async function onAccess(e: FormEvent) {
    e.preventDefault()
    if (!accessCode.trim() || accessBusy) return
    setAccessBusy(true)
    setAccessError(null)
    try {
      const result = await unlockWithCode(accessCode.trim())
      setAccessCode('')
      navigate(`/events/${result.gathering.id}`, { viewTransition: true })
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : t('accessCodeFailed'))
    } finally {
      setAccessBusy(false)
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
        <LanguageSwitcher />
      </header>

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

          {mode === 'choose' && (
            <div className="landing-actions">
              <button
                className="btn btn-accent landing-action"
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
              <p className="sub">{t('accessWithCodeSub')}</p>
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
