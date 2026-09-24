import { useI18n } from '../i18n/I18nContext'
import type { AgeGroup } from '../types'

type Props = {
  value: AgeGroup
  onChange: (value: AgeGroup) => void
  label?: string
}

export function AgeGroupPicker({ value, onChange, label }: Props) {
  const { t } = useI18n()

  return (
    <fieldset className="age-group-picker">
      {label ? <legend>{label}</legend> : <legend>{t('ageGroup')}</legend>}
      <div className="age-group-options" role="radiogroup" aria-label={t('ageGroup')}>
        <button
          type="button"
          className={`age-option ${value === 'adult' ? 'selected' : ''}`}
          aria-pressed={value === 'adult'}
          onClick={() => onChange('adult')}
        >
          {t('ageAdult')}
        </button>
        <button
          type="button"
          className={`age-option ${value === 'child' ? 'selected' : ''}`}
          aria-pressed={value === 'child'}
          onClick={() => onChange('child')}
        >
          {t('ageChild')}
        </button>
      </div>
    </fieldset>
  )
}
