import { useI18n } from '../i18n/I18nContext'
import { toggleCarteSelection } from '../lib/money'
import type { CarteItem } from '../types'

type Props = {
  items: CarteItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel?: string
}

export function CartePicker({
  items,
  selectedIds,
  onChange,
  emptyLabel,
}: Props) {
  const { t } = useI18n()

  if (items.length === 0) {
    return <p className="sub">{emptyLabel || t('carteEmpty')}</p>
  }

  return (
    <div className="carte-picker" role="group" aria-label={t('pickFromCarte')}>
      <p className="sub carte-picker-hint">{t('pickFromCarteHint')}</p>
      <ul className="carte-picker-list">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`carte-pick-btn ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onChange(toggleCarteSelection(selectedIds, item.id))}
              >
                <span className="carte-pick-check" aria-hidden>
                  {selected ? '✓' : ''}
                </span>
                <span>{item.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {selectedIds.length > 0 && (
        <p className="sub carte-pick-count">
          {t('carteSelectedCount', { count: selectedIds.length })}
        </p>
      )}
    </div>
  )
}
