/** Outstanding-payment nudge links (WhatsApp / mailto / SMS). */

export function digitsOnlyPhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '')
}

export function unpaidNudgeText(input: {
  guestName: string
  eventTitle: string
  amountLabel: string
  locale: 'pt' | 'en'
}): string {
  if (input.locale === 'pt') {
    return `Olá ${input.guestName} — em ${input.eventTitle} ainda faltam ${input.amountLabel}. Obrigado!`
  }
  return `Hi ${input.guestName} — for ${input.eventTitle} there is still ${input.amountLabel} outstanding. Thanks!`
}

export function whatsappNudgeUrl(phone: string, text: string): string | null {
  const digits = digitsOnlyPhone(phone)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function smsNudgeUrl(phone: string, text: string): string | null {
  const digits = digitsOnlyPhone(phone)
  if (!digits) return null
  return `sms:${digits}?body=${encodeURIComponent(text)}`
}

export function mailtoNudgeUrl(email: string, subject: string, text: string): string | null {
  const trimmed = String(email || '').trim()
  if (!trimmed || !trimmed.includes('@')) return null
  return `mailto:${encodeURIComponent(trimmed)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}
