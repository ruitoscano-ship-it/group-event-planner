/** Safe http(s) or data:image URL for menu cards — blocks javascript: etc. */
export function safeMediaUrl(raw: string | undefined | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (value.startsWith('data:image/')) {
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(value)) return ''
    return value
  }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    if (parsed.username || parsed.password) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}
