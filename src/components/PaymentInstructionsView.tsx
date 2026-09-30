import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { hasPaymentInstructions } from '../lib/paymentInfo'
import { safeMediaUrl } from '../lib/safeUrl'
import type { Gathering } from '../types'

type Props = {
  gathering: Pick<
    Gathering,
    | 'paymentIban'
    | 'paymentMbWay'
    | 'paymentBizum'
    | 'paymentNote'
    | 'paymentQrUrl'
  >
  compact?: boolean
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <div className="full payment-copy-row">
      <dt>{label}</dt>
      <dd>
        {mono ? <code>{value}</code> : <span>{value}</span>}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </dd>
    </div>
  )
}

export function PaymentInstructionsView({ gathering, compact = false }: Props) {
  const { t } = useI18n()
  if (!hasPaymentInstructions(gathering)) return null
  const qr = safeMediaUrl(gathering.paymentQrUrl)

  return (
    <div className={`payment-instructions ${compact ? 'compact' : ''}`}>
      {!compact && <h3>{t('paymentHowToPay')}</h3>}
      {compact && <strong>{t('paymentHowToPay')}</strong>}
      <p className="sub">{t('paymentHowToPaySub')}</p>
      <dl className="details-summary">
        {gathering.paymentIban.trim() && (
          <CopyRow label={t('paymentIban')} value={gathering.paymentIban.trim()} mono />
        )}
        {gathering.paymentMbWay.trim() && (
          <CopyRow label={t('paymentMbWay')} value={gathering.paymentMbWay.trim()} />
        )}
        {gathering.paymentBizum.trim() && (
          <CopyRow label={t('paymentBizum')} value={gathering.paymentBizum.trim()} />
        )}
        {gathering.paymentNote.trim() && (
          <div className="full payment-copy-row payment-note-row">
            <dt>{t('paymentNote')}</dt>
            <dd>{gathering.paymentNote.trim()}</dd>
          </div>
        )}
      </dl>
      {qr && (
        <img
          className="payment-qr"
          src={qr}
          alt={t('paymentQrAlt')}
          loading="lazy"
        />
      )}
    </div>
  )
}
