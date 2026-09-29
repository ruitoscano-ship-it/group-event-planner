/** Organizer unlock codes — normalize / format / generate. */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeOrganizerCode(code: string): string {
  return String(code || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

export function formatOrganizerCode(code: string): string {
  const raw = normalizeOrganizerCode(code)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

export function generateOrganizerCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let raw = ''
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return formatOrganizerCode(raw)
}

export function codesMatch(a: string, b: string): boolean {
  const left = normalizeOrganizerCode(a)
  const right = normalizeOrganizerCode(b)
  return Boolean(left) && left === right
}
