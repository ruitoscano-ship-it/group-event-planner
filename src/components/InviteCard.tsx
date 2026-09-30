import { useI18n } from '../i18n/I18nContext'
import { formatDate } from '../lib/money'
import { mapsSearchUrl } from '../lib/inviteShare'
import type { Gathering } from '../types'

type Props = {
  gathering: Pick<
    Gathering,
    | 'title'
    | 'type'
    | 'date'
    | 'time'
    | 'location'
    | 'notes'
    | 'organizerName'
    | 'menu'
    | 'carteItems'
    | 'carteApproved'
    | 'menuCardUrl'
  >
  /** Extra line under notes (e.g. coming count). */
  footer?: string
  showMapsLink?: boolean
  className?: string
  compact?: boolean
}

export function InviteCard({
  gathering,
  footer,
  showMapsLink = false,
  className = '',
  compact = false,
}: Props) {
  const { t, localeTag } = useI18n()
  const typeLabel =
    gathering.type === 'lunch'
      ? t('typeLunch')
      : gathering.type === 'dinner'
        ? t('typeDinner')
        : gathering.type === 'brunch'
          ? t('typeBrunch')
          : t('typeOther')
  const where = (gathering.location || '').trim()
  const maps = where && showMapsLink ? mapsSearchUrl(where) : ''
  const hasMenuPeek =
    gathering.menu.length > 0 ||
    (gathering.carteApproved && (gathering.carteItems || []).length > 0) ||
    Boolean(gathering.menuCardUrl)

  return (
    <article
      className={`invite-card ${compact ? 'invite-card-compact' : ''} ${className}`.trim()}
    >
      <div className="invite-card-meta">
        <span className="chip">{typeLabel}</span>
        <span className="chip chip-warm">
          {formatDate(gathering.date, localeTag, t('dateTbd'))}
        </span>
        {gathering.time && <span className="chip chip-muted">{gathering.time}</span>}
      </div>
      <h2 className="invite-card-title">{gathering.title}</h2>
      <p className="invite-card-where">
        {where || t('locationTbd')}
        {maps && (
          <>
            {' · '}
            <a href={maps} target="_blank" rel="noopener noreferrer">
              {t('openInMaps')}
            </a>
          </>
        )}
      </p>
      {gathering.organizerName?.trim() && (
        <p className="invite-card-host">
          {t('inviteHostedBy', { name: gathering.organizerName.trim() })}
        </p>
      )}
      {!compact && gathering.notes?.trim() && (
        <p className="invite-card-notes">{gathering.notes.trim()}</p>
      )}
      {!compact && hasMenuPeek && (
        <p className="invite-card-peek sub">{t('inviteMenuReady')}</p>
      )}
      {footer && <p className="invite-card-footer sub">{footer}</p>}
    </article>
  )
}
