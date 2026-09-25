import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  localeTag,
  translations,
  type Locale,
  type TranslationKey,
} from './translations'

const STORAGE_KEY = 'round-locale-v1'

type Vars = Record<string, string | number>

type I18n = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Vars) => string
  localeTag: string
}

const I18nContext = createContext<I18n | null>(null)

function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'en' || raw === 'pt') return raw
  } catch {
    // ignore
  }
  return 'pt'
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  )
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = localeTag[locale]
    document.title = 'Round — The Gatherings app'

    const description =
      locale === 'pt'
        ? 'The Gatherings app by Round — planeie almoços e jantares em grupo, partilhe menus, recolha RSVPs e acompanhe quem ainda deve.'
        : 'The Gatherings app by Round — plan group lunches and dinners, share menus, collect RSVPs, and track who still owes.'

    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) metaDescription.setAttribute('content', description)

    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', 'Round — The Gatherings app')

    const ogDescription = document.querySelector('meta[property="og:description"]')
    if (ogDescription) {
      ogDescription.setAttribute(
        'content',
        locale === 'pt'
          ? 'The Gatherings app — planeie almoços e jantares em grupo, partilhe menus, recolha RSVPs e acompanhe quem ainda deve.'
          : 'The Gatherings app — plan group lunches and dinners, share menus, collect RSVPs, and track who still owes.',
      )
    }

    const twitterTitle = document.querySelector('meta[name="twitter:title"]')
    if (twitterTitle) {
      twitterTitle.setAttribute('content', 'Round — The Gatherings app')
    }

    const twitterDescription = document.querySelector(
      'meta[name="twitter:description"]',
    )
    if (twitterDescription) {
      twitterDescription.setAttribute(
        'content',
        locale === 'pt'
          ? 'The Gatherings app — planeie almoços e jantares em grupo, partilhe menus, recolha RSVPs e acompanhe quem ainda deve.'
          : 'The Gatherings app — plan group lunches and dinners, share menus, collect RSVPs, and track who still owes.',
      )
    }
  }, [locale])

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) =>
      interpolate(translations[locale][key], vars),
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      localeTag: localeTag[locale],
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
