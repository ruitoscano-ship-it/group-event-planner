import { useI18n } from '../i18n/I18nContext'
import type { Locale } from '../i18n/translations'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="lang-switch" role="group" aria-label={t('language')}>
      {(['pt', 'en'] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-btn ${locale === code ? 'active' : ''}`}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {code === 'pt' ? t('langPt') : t('langEn')}
        </button>
      ))}
    </div>
  )
}
