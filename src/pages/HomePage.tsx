import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreateEventChat } from '../components/CreateEventChat'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
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

  async function handleCreate(input: GatheringInput) {
    const created = await createGathering(input)
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
        <Link viewTransition to="/" className="brand">
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
            <CreateEventChat
              onCancel={() => setMode('choose')}
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
                  onClick={() => {
                    setMode('choose')
                    setAccessError(null)
                  }}
                >
                  {t('cancel')}
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
                  <button className="btn btn-accent" type="submit" disabled={accessBusy}>
                    {accessBusy ? t('saving') : t('openWithCode')}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </section>
    </>
  )
}
