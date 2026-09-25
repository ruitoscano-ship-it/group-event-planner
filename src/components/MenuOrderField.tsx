import { useI18n } from '../i18n/I18nContext'

type Props = {
  value: string
  onChange: (value: string) => void
  ocrLines: string[]
  placeholder?: string
}

export function MenuOrderField({
  value,
  onChange,
  ocrLines,
  placeholder,
}: Props) {
  const { t } = useI18n()

  function addFromDropdown(line: string) {
    if (!line) return
    const current = value.trim()
    if (!current) {
      onChange(line)
      return
    }
    if (current.toLowerCase().includes(line.toLowerCase())) return
    onChange(`${current}, ${line}`)
  }

  return (
    <div className="menu-order-field">
      {ocrLines.length > 0 && (
        <label className="menu-order-select-label">
          {t('ocrPickFromMenu')}
          <select
            className="menu-order-select"
            defaultValue=""
            onChange={(e) => {
              addFromDropdown(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="">{t('ocrPickPlaceholder')}</option>
            {ocrLines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t('menuRequest')}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('menuRequestPlaceholder')}
          rows={3}
        />
      </label>
    </div>
  )
}
