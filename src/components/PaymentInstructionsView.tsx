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
          <div className="full">
            <dt>{t('paymentIban')}</dt>
            <dd>
              <code>{gathering.paymentIban.trim()}</code>
            </dd>
          </div>
        )}
        {gathering.paymentMbWay.trim() && (
          <div>
            <dt>{t('paymentMbWay')}</dt>
            <dd>{gathering.paymentMbWay.trim()}</dd>
          </div>
        )}
        {gathering.paymentBizum.trim() && (
          <div>
            <dt>{t('paymentBizum')}</dt>
            <dd>{gathering.paymentBizum.trim()}</dd>
          </div>
        )}
        {gathering.paymentNote.trim() && (
          <div className="full">
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
