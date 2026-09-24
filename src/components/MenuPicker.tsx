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
    <div className="menu-picker">
      {menu.map((item) => {
        const selected = selectedIds.includes(item.id)
        return (
          <label
            key={item.id}
            className={`menu-option ${selected ? 'selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(item.id)}
            />
            <span>
              <strong>{item.name}</strong>
              {item.isAlaCarte && (
                <>
                  {' '}
                  <span className="chip chip-warm">{t('alaCarte')}</span>
                </>
              )}
              <br />
              <span className="menu-option-meta" style={{ fontSize: '0.85rem' }}>
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
          </label>
        )
      })}
    </div>
  )
}
