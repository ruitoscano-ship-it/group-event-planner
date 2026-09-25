import { useMemo, useState, type FormEvent } from 'react'
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
  const [assisted, setAssisted] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const firstEvent = useMemo(() => shouldUseAssistedMode(), [])

  function goHome() {
    setMode('choose')
    setAssisted(false)
    setAccessError(null)
    setAccessCode('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCreate(input: GatheringInput) {
    const created = await createGathering(input)
    const q = assisted ? 'created=1&assisted=1' : 'created=1'
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
        <div className="landing-visual" role="img" aria-label={t('brandAria')} />
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
                onClick={() => {
                  const guide = shouldUseAssistedMode()
                  setAssisted(guide)
                  setMode('create')
                }}
              >
                {firstEvent ? t('createFirstEvent') : t('createEvent')}
              </button>
              {firstEvent && (
                <p className="assisted-landing-hint">{t('assistedLandingHint')}</p>
              )}
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
            <CreateEventChat
              assisted={assisted}
              onCancel={goHome}
              onCreate={handleCreate}
            />
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
        <section className="home-about" aria-labelledby="home-about-title">
          <h2 id="home-about-title">{t('homeAboutTitle')}</h2>
          <p className="home-about-lede">{t('homeAboutLede')}</p>
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
      )}

      <footer className="site-footer">
        <div className="site-footer-brand">
          <strong>
            Round<span>.</span>
          </strong>
          <p>{t('footerTagline')}</p>
        </div>
        <div className="site-footer-cols">
          <div>
            <h3>{t('footerPrivacyTitle')}</h3>
            <p>{t('footerPrivacyBody')}</p>
          </div>
          <div>
            <h3>{t('footerDisclaimerTitle')}</h3>
            <p>{t('footerDisclaimerBody')}</p>
          </div>
          <div>
            <h3>{t('footerTermsTitle')}</h3>
            <p>{t('footerTermsBody')}</p>
          </div>
        </div>
        <p className="site-footer-copy">
          {t('footerCopyright', { year: new Date().getFullYear() })}
        </p>
      </footer>
    </>
  )
}
