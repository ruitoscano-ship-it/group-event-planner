import { useI18n } from '../i18n/I18nContext'
import type { CarteItem } from '../types'
import { CartePicker } from './CartePicker'

type Props = {
  carteItems: CarteItem[]
  carteApproved: boolean
  selectedCarteIds: string[]
  onCarteChange: (ids: string[]) => void
  menuRequest: string
  onMenuRequestChange: (value: string) => void
  placeholder?: string
}

export function MenuOrderField({
  carteItems,
  carteApproved,
  selectedCarteIds,
  onCarteChange,
  menuRequest,
  onMenuRequestChange,
  placeholder,
}: Props) {
  const { t } = useI18n()
  const showCarte = carteApproved && carteItems.length > 0

  return (
    <div className="menu-order-field">
      {showCarte ? (
        <CartePicker
          items={carteItems}
          selectedIds={selectedCarteIds}
          onChange={onCarteChange}
        />
      ) : (
        <p className="sub">{t('carteNotReady')}</p>
      )}
      <label>
        {showCarte ? t('menuRequestExtras') : t('menuRequest')}
        <textarea
          value={menuRequest}
          onChange={(e) => onMenuRequestChange(e.target.value)}
          placeholder={
            placeholder ||
            (showCarte ? t('menuRequestExtrasPlaceholder') : t('menuRequestPlaceholder'))
          }
          rows={3}
        />
      </label>
    </div>
  )
}
