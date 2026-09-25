import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { carteLabel, toggleCarteSelection } from '../lib/money'
import type { CarteItem } from '../types'

type Props = {
  items: CarteItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel?: string
  /** When set, controls initial open state. Default: open if nothing selected yet. */
  defaultOpen?: boolean
}

export function CartePicker({
  items,
  selectedIds,
  onChange,
  emptyLabel,
  defaultOpen,
}: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(
    () => defaultOpen ?? selectedIds.length === 0,
  )

  if (items.length === 0) {
    return <p className="sub">{emptyLabel || t('carteEmpty')}</p>
  }

  const selectedSummary =
    carteLabel(selectedIds, items, '') || t('carteNoneSelected')

  return (
    <details
      className="carte-picker"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="carte-picker-summary">
        <span className="carte-picker-summary-title">
          {t('pickFromCarte')}
          {selectedIds.length > 0 && (
            <span className="carte-picker-badge">
              {t('carteSelectedCount', { count: selectedIds.length })}
            </span>
          )}
        </span>
        <span className="carte-picker-summary-picks">{selectedSummary}</span>
      </summary>

      <div className="carte-picker-body">
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
                  onClick={() =>
                    onChange(toggleCarteSelection(selectedIds, item.id))
                  }
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
      </div>
    </details>
  )
}
