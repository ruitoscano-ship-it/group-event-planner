/** Maps deep links + change-of-plan invite drafts. */

export function mapsSearchUrl(location: string): string {
  const q = String(location || '').trim()
  if (!q) return ''
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

export function appleMapsSearchUrl(location: string): string {
  const q = String(location || '').trim()
  if (!q) return ''
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}`
}

export function buildInviteShareText(input: {
  title: string
  dateLabel: string
  time: string
  location: string
  rsvpUrl: string
  locale: 'pt' | 'en'
  includeMaps?: boolean
}): string {
  const when = [input.dateLabel, input.time].filter(Boolean).join(' · ')
  const where = input.location || ''
  const maps =
    input.includeMaps !== false && where ? mapsSearchUrl(where) : ''

  if (input.locale === 'pt') {
    return [
      `Convite: ${input.title}`,
      when ? `Quando: ${when}` : '',
      where ? `Onde: ${where}` : '',
      maps ? `Mapa: ${maps}` : '',
      '',
      `Confirma aqui: ${input.rsvpUrl}`,
    ]
      .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
      .join('\n')
      .trim()
  }
  return [
    `You're invited: ${input.title}`,
    when ? `When: ${when}` : '',
    where ? `Where: ${where}` : '',
    maps ? `Map: ${maps}` : '',
    '',
    `RSVP here: ${input.rsvpUrl}`,
  ]
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim()
}

export function buildChangeOfPlanText(input: {
  title: string
  dateLabel: string
  time: string
  location: string
  rsvpUrl: string
  locale: 'pt' | 'en'
}): string {
  const when = [input.dateLabel, input.time].filter(Boolean).join(' · ')
  const where = (input.location || '').trim()
  const maps = where ? mapsSearchUrl(where) : ''

  if (input.locale === 'pt') {
    return [
      `Atualização — ${input.title}`,
      'O plano mudou:',
      when ? `Novo horário: ${when}` : '',
      where ? `Novo local: ${where}` : '',
      maps ? `Mapa: ${maps}` : '',
      '',
      `Detalhes / RSVP: ${input.rsvpUrl}`,
    ]
      .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
      .join('\n')
      .trim()
  }
  return [
    `Update — ${input.title}`,
    'The plan changed:',
    when ? `New time: ${when}` : '',
    where ? `New place: ${where}` : '',
    maps ? `Map: ${maps}` : '',
    '',
    `Details / RSVP: ${input.rsvpUrl}`,
  ]
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim()
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export async function nativeShare(input: {
  title: string
  text: string
  url: string
}): Promise<'shared' | 'unsupported' | 'cancelled'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unsupported'
  }
  try {
    await navigator.share({
      title: input.title,
      text: input.text,
      url: input.url,
    })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

/** Public QR image URL for walk-up RSVP (no local dependency). */
export function rsvpQrImageUrl(rsvpUrl: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rsvpUrl)}`
}
