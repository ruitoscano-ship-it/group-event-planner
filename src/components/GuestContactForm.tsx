import { type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'

export type GuestContactValues = {
  fromName: string
  fromEmail: string
  fromPhone: string
  body: string
}

type Props = {
  values: GuestContactValues
  onChange: (next: GuestContactValues) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
  busy?: boolean
  message?: string | null
  error?: boolean
}

export function GuestContactForm({
  values,
  onChange,
  onSubmit,
  onClose,
  busy = false,
  message = null,
  error = false,
}: Props) {
  const { t } = useI18n()

  return (
    <section className="panel guest-contact-panel">
      <div className="details-panel-head">
        <div>
          <h2>{t('contactOrganizer')}</h2>
          <p className="sub">{t('contactOrganizerSub')}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          {t('dismiss')}
        </button>
      </div>
      {message && (
        <div className={`feedback-banner ${error ? 'error' : ''}`} role="status">
          {message}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="full">
            {t('yourName')}
            <input
              required
              value={values.fromName}
              onChange={(e) => onChange({ ...values, fromName: e.target.value })}
              autoComplete="name"
            />
          </label>
          <label>
            {t('emailOptional')}
            <input
              type="email"
              value={values.fromEmail}
              onChange={(e) => onChange({ ...values, fromEmail: e.target.value })}
              autoComplete="email"
            />
          </label>
          <label>
            {t('phoneOptional')}
            <input
              type="tel"
              value={values.fromPhone}
              onChange={(e) => onChange({ ...values, fromPhone: e.target.value })}
              autoComplete="tel"
            />
          </label>
          <label className="full">
            {t('contactMessage')}
            <textarea
              required
              value={values.body}
              onChange={(e) => onChange({ ...values, body: e.target.value })}
              placeholder={t('contactMessagePlaceholder')}
              rows={3}
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-accent" type="submit" disabled={busy}>
            {busy ? t('saving') : t('sendMessage')}
          </button>
        </div>
      </form>
    </section>
  )
}
