import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import { formatOrganizerCode } from '../lib/organizerAccess'
import { useGatherings } from '../store/GatheringsContext'
import type { GatheringInput } from '../types'

const emptyForm: GatheringInput = {
  title: '',
  type: 'lunch',
  date: '',
  time: '13:00',
  location: '',
  notes: '',
  currency: 'EUR',
  organizerName: '',
  organizerEmail: '',
  organizerPhone: '',
}

type Mode = 'choose' | 'create' | 'code'

export function HomePage() {
  const { createGathering, unlockWithCode } = useGatherings()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('choose')
  const [form, setForm] = useState<GatheringInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    setFormError(null)
    try {
      const created = await createGathering({
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        organizerName: (form.organizerName || '').trim(),
        organizerEmail: (form.organizerEmail || '').trim(),
        organizerPhone: (form.organizerPhone || '').trim(),
      })
      setForm(emptyForm)
      navigate(`/events/${created.gathering.id}?created=1`, { viewTransition: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('createFailed'))
    } finally {
      setSaving(false)
    }
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
                onClick={() => {
                  setMode('create')
                  setFormError(null)
                }}
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
            <section className="landing-panel">
              <div className="landing-panel-head">
                <h2>{t('createGathering')}</h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMode('choose')
                    setFormError(null)
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
              <p className="sub">{t('createGatheringSub')}</p>
              {formError && <p className="allergy">{formError}</p>}
              <form onSubmit={(e) => void onSubmit(e)}>
                <div className="form-grid">
                  <label className="full">
                    {t('title')}
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder={t('placeholderTitle')}
                      autoFocus
                    />
                  </label>
                  <label>
                    {t('type')}
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          type: e.target.value as GatheringInput['type'],
                        })
                      }
                    >
                      <option value="lunch">{t('typeLunch')}</option>
                      <option value="dinner">{t('typeDinner')}</option>
                      <option value="brunch">{t('typeBrunch')}</option>
                      <option value="other">{t('typeOther')}</option>
                    </select>
                  </label>
                  <label>
                    {t('currency')}
                    <input
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('date')}
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('time')}
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    {t('location')}
                    <input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder={t('placeholderLocation')}
                    />
                  </label>
                  <label className="full">
                    {t('notes')}
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={t('placeholderNotes')}
                      rows={3}
                    />
                  </label>
                  <label>
                    {t('organizerName')}
                    <input
                      value={form.organizerName || ''}
                      onChange={(e) =>
                        setForm({ ...form, organizerName: e.target.value })
                      }
                      placeholder={t('organizerNamePlaceholder')}
                    />
                  </label>
                  <label>
                    {t('organizerEmail')}
                    <input
                      type="email"
                      value={form.organizerEmail || ''}
                      onChange={(e) =>
                        setForm({ ...form, organizerEmail: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {t('organizerPhone')}
                    <input
                      type="tel"
                      value={form.organizerPhone || ''}
                      onChange={(e) =>
                        setForm({ ...form, organizerPhone: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button className="btn btn-accent" type="submit" disabled={saving}>
                    {saving ? t('saving') : t('saveAndAddMenu')}
                  </button>
                </div>
              </form>
            </section>
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
