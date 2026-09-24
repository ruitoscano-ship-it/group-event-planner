import type { TranslationKey } from '../i18n/translations'

export function pickFeedback(
  t: (key: TranslationKey) => string,
  keys: TranslationKey[],
): string {
  const key = keys[Math.floor(Math.random() * keys.length)] ?? keys[0]
  return t(key)
}

export const rsvpSuccessKeys = [
  'feedbackRsvp1',
  'feedbackRsvp2',
  'feedbackRsvp3',
] as const satisfies readonly TranslationKey[]

export const guestAddedKeys = [
  'feedbackGuest1',
  'feedbackGuest2',
  'feedbackGuest3',
] as const satisfies readonly TranslationKey[]

export const detailsSavedKeys = [
  'feedbackDetails1',
  'feedbackDetails2',
  'feedbackDetails3',
] as const satisfies readonly TranslationKey[]

export const menuCardSavedKeys = [
  'feedbackMenuCard1',
  'feedbackMenuCard2',
  'feedbackMenuCard3',
] as const satisfies readonly TranslationKey[]

export const menuItemSavedKeys = [
  'feedbackMenuItem1',
  'feedbackMenuItem2',
] as const satisfies readonly TranslationKey[]
