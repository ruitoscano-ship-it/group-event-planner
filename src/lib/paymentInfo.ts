/** Helpers for organizer payment instructions (manual settle — no payment processor). */

import type { Gathering } from '../types'
import { safeMediaUrl } from './safeUrl'

export function hasPaymentInstructions(
  g: Pick<
    Gathering,
    'paymentIban' | 'paymentMbWay' | 'paymentBizum' | 'paymentNote' | 'paymentQrUrl'
  >,
): boolean {
  return Boolean(
    (g.paymentIban || '').trim() ||
      (g.paymentMbWay || '').trim() ||
      (g.paymentBizum || '').trim() ||
      (g.paymentNote || '').trim() ||
      safeMediaUrl(g.paymentQrUrl),
  )
}

export function emptyPaymentFields() {
  return {
    paymentIban: '',
    paymentMbWay: '',
    paymentBizum: '',
    paymentNote: '',
    paymentQrUrl: '',
  }
}
