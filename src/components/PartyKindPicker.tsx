import { useI18n } from '../i18n/I18nContext'

export type PartyKind = 'individual' | 'group'

type Props = {
  value: PartyKind | null
  onChange: (value: PartyKind) => void
}

export function PartyKindPicker({ value, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="party-kind" role="group" aria-label={t('partyKindLabel')}>
      <button
        type="button"
        className={`party-kind-option ${value === 'individual' ? 'selected' : ''}`}
        onClick={() => onChange('individual')}
        aria-pressed={value === 'individual'}
      >
        <strong>{t('partyKindIndividual')}</strong>
        <span>{t('partyKindIndividualSub')}</span>
      </button>
      <button
        type="button"
        className={`party-kind-option ${value === 'group' ? 'selected' : ''}`}
        onClick={() => onChange('group')}
        aria-pressed={value === 'group'}
      >
        <strong>{t('partyKindGroup')}</strong>
        <span>{t('partyKindGroupSub')}</span>
      </button>
    </div>
  )
}
