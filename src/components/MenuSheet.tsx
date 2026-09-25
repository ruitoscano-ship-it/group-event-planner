import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { formatMoney } from '../lib/money'
import type { Gathering } from '../types'

type Props = {
  gathering: Gathering
  /** Compact trigger for tight layouts */
  compact?: boolean
}

export function MenuSheet({ gathering, compact = false }: Props) {
  const { t, localeTag } = useI18n()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const hasCard = Boolean(gathering.menuCardUrl)
  const hasItems = gathering.menu.length > 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!hasCard && !hasItems) return null

  return (
    <>
      <button
        type="button"
        className={`btn ${compact ? 'btn-ghost btn-sm' : 'btn-ghost'} menu-peek-btn`}
        onClick={() => setOpen(true)}
      >
        {t('checkMenu')}
      </button>

      {open && (
        <div
          className="menu-sheet-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-sheet-head">
              <div>
                <h2 id={titleId}>{t('menuSheetTitle')}</h2>
                <p className="sub">{t('menuSheetSub')}</p>
              </div>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => setOpen(false)}
              >
                {t('menuSheetClose')}
              </button>
            </div>

            <div className="menu-sheet-body">
              {hasCard && (
                <div className="menu-sheet-card">
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

              {hasItems && (
                <div className="menu-sheet-list">
                  <h3>{t('currentMenu')}</h3>
                  <ul>
                    {gathering.menu.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          {item.isAlaCarte && (
                            <>
                              {' '}
                              <span className="chip chip-warm">{t('alaCarte')}</span>
                            </>
                          )}
                          <p>
                            {item.category}
                            {item.description ? ` · ${item.description}` : ''}
                          </p>
                        </div>
                        <span className="price">
                          {item.isAlaCarte
                            ? t('priceVariable')
                            : formatMoney(item.price, gathering.currency, localeTag)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
