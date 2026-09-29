import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { flattenInvitees } from '../lib/report'
import type { Gathering } from '../types'

type Props = {
  gathering: Gathering
}

type Filter = 'all' | 'allergies'

export function KitchenBoard({ gathering }: Props) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const people = useMemo(() => flattenInvitees(gathering), [gathering])
  const rows = useMemo(() => {
    if (filter === 'allergies') {
      return people.filter((p) => (p.allergies || '').trim())
    }
    return people
  }, [people, filter])
  const allergyCount = people.filter((p) => (p.allergies || '').trim()).length

  return (
    <div className="kitchen-board">
      <div className="payment-filters" role="group" aria-label={t('kitchenFilterLabel')}>
        <button
          type="button"
          className={`btn btn-sm ${filter === 'all' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setFilter('all')}
        >
          {t('kitchenFilterAll')} ({people.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === 'allergies' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setFilter('allergies')}
        >
          {t('kitchenFilterAllergies')} ({allergyCount})
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="sub">{t('kitchenEmpty')}</p>
      ) : (
        <div className="kitchen-table-wrap">
          <table className="kitchen-table">
            <thead>
              <tr>
                <th>{t('reportPerson')}</th>
                <th>{t('ageGroup')}</th>
                <th>{t('pickFromMenu')}</th>
                <th>{t('allergiesDietary')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.allergies.trim() ? 'has-allergy' : ''}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.party !== p.name && (
                      <span className="sub"> · {p.party}</span>
                    )}
                  </td>
                  <td>{p.ageGroup === 'child' ? t('ageChild') : t('ageAdult')}</td>
                  <td>
                    {[p.menu !== '—' ? p.menu : '', p.carte !== '—' ? p.carte : '', p.extras !== '—' ? p.extras : '']
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    {p.allergies.trim() ? (
                      <strong className="allergy-flag">{p.allergies}</strong>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
