/** Build invite share text and WhatsApp / native share helpers. */

export function buildInviteShareText(input: {
  title: string
  dateLabel: string
  time: string
  location: string
  rsvpUrl: string
  locale: 'pt' | 'en'
}): string {
  const when = [input.dateLabel, input.time].filter(Boolean).join(' · ')
  const where = input.location || ''
  if (input.locale === 'pt') {
    return [
      `Convite: ${input.title}`,
      when ? `Quando: ${when}` : '',
      where ? `Onde: ${where}` : '',
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
    '',
    `RSVP here: ${input.rsvpUrl}`,
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
