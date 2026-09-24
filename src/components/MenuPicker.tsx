import { useI18n } from '../i18n/I18nContext'
import { formatMoney } from '../lib/money'
import type { MenuItem } from '../types'

type Props = {
  menu: MenuItem[]
  selectedIds: string[]
  currency: string
  onToggle: (itemId: string) => void
  emptyLabel: string
}

export function MenuPicker({
  menu,
  selectedIds,
  currency,
  onToggle,
  emptyLabel,
}: Props) {
  const { t, localeTag } = useI18n()

  if (menu.length === 0) {
    return <div className="empty">{emptyLabel}</div>
  }

  return (
    <div className="menu-picker" role="group" aria-label={t('pickFromMenu')}>
      {menu.map((item) => {
        const selected = selectedIds.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            className={`menu-option ${selected ? 'selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onToggle(item.id)}
          >
            <span className="menu-check" aria-hidden>
              {selected ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path
                    d="M5 12.5 9.5 17 19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="menu-option-copy">
              <span className="menu-option-title">
                <strong>{item.name}</strong>
                {item.isAlaCarte && (
                  <span className="chip chip-warm">{t('alaCarte')}</span>
                )}
                {selected && (
                  <span className="menu-selected-tag">{t('selectedTag')}</span>
                )}
              </span>
              <span className="menu-option-meta">
                {item.category}
                {item.description ? ` · ${item.description}` : ''}
              </span>
            </span>
            <span className="menu-option-price">
              {!item.isAlaCarte && (
                <span className="est-label">{t('estimatedShort')}</span>
              )}
              <span className="price">
                {item.isAlaCarte
                  ? t('priceVariable')
                  : formatMoney(item.price, currency, localeTag)}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
