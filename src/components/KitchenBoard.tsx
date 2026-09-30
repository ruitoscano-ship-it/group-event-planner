import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import {
  buildAllergyDigestText,
  buildBookingPingText,
} from '../lib/dayOfShare'
import { formatDate } from '../lib/money'
import { flattenInvitees } from '../lib/report'
import { whatsappShareUrl } from '../lib/inviteShare'
import type { Gathering } from '../types'

type Props = {
  gathering: Gathering
}

type Filter = 'all' | 'allergies'

export function KitchenBoard({ gathering }: Props) {
  const { t, locale, localeTag } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null)
  const people = useMemo(() => flattenInvitees(gathering), [gathering])
  const rows = useMemo(() => {
    if (filter === 'allergies') {
      return people.filter((p) => (p.allergies || '').trim())
    }
    return people
  }, [people, filter])
  const allergyCount = people.filter((p) => (p.allergies || '').trim()).length

  async function copyText(text: string, okLabel: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMsg(okLabel)
      window.setTimeout(() => setCopiedMsg(null), 1800)
    } catch {
      setCopiedMsg(null)
    }
  }

  const allergyText = buildAllergyDigestText(gathering, locale)
  const bookingText = buildBookingPingText(gathering, {
    dateLabel: formatDate(gathering.date, localeTag, t('dateTbd')),
    locale,
  })

  return (
    <div className="kitchen-board">
      <div className="kitchen-share-actions">
        <button
          type="button"
          className="btn btn-sm btn-accent"
          onClick={() =>
            window.open(whatsappShareUrl(allergyText), '_blank', 'noopener,noreferrer')
          }
        >
          {t('allergyDigestWhatsApp')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => void copyText(allergyText, t('allergyDigestCopied'))}
        >
          {t('allergyDigestCopy')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() =>
            window.open(whatsappShareUrl(bookingText), '_blank', 'noopener,noreferrer')
          }
        >
          {t('bookingPingWhatsApp')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => void copyText(bookingText, t('bookingPingCopied'))}
        >
          {t('bookingPingCopy')}
        </button>
      </div>
      {copiedMsg && (
        <div className="feedback-banner" role="status">
          {copiedMsg}
        </div>
      )}
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
