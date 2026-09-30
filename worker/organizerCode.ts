/** Organizer unlock codes — normalize / format / generate. */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

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
  const alphabetLen = CODE_ALPHABET.length
  // Rejection sampling avoids modulo bias
  const max = 256 - (256 % alphabetLen)
  let raw = ''
  while (raw.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (const b of bytes) {
      if (b >= max) continue
      raw += CODE_ALPHABET[b % alphabetLen]
      if (raw.length >= 8) break
    }
  }
  return formatOrganizerCode(raw)
}

export function codesMatch(a: string, b: string): boolean {
  const left = normalizeOrganizerCode(a)
  const right = normalizeOrganizerCode(b)
  if (!left || !right) return false
  return timingSafeEqual(left, right)
}
