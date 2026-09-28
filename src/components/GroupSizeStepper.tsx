import { useI18n } from '../i18n/I18nContext'

type Props = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function GroupSizeStepper({
  value,
  onChange,
  min = 2,
  max = 12,
}: Props) {
  const { t } = useI18n()
  const safe = Math.max(min, Math.min(max, value))

  return (
    <div className="group-size" role="group" aria-label={t('groupSizeLabel')}>
      <p className="group-size-label">{t('groupSizeLabel')}</p>
      <div className="group-size-controls">
        <button
          type="button"
          className="btn btn-ghost group-size-btn"
          onClick={() => onChange(Math.max(min, safe - 1))}
          disabled={safe <= min}
          aria-label={t('groupSizeFewer')}
        >
          −
        </button>
        <output className="group-size-value" aria-live="polite">
          {safe}
          <span>
            {safe === 1 ? t('personLabel') : t('peopleLabel')}
          </span>
        </output>
        <button
          type="button"
          className="btn btn-ghost group-size-btn"
          onClick={() => onChange(Math.min(max, safe + 1))}
          disabled={safe >= max}
          aria-label={t('groupSizeMore')}
        >
          +
        </button>
      </div>
    </div>
  )
}
