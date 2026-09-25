/** Admin session + crypto helpers for the Round backoffice. */

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function adminConfigured(env: { ADMIN_PASSWORD?: string }): boolean {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 8)
}

export async function verifyAdminPassword(
  env: { ADMIN_PASSWORD?: string },
  password: string,
): Promise<boolean> {
  if (!adminConfigured(env)) return false
  return timingSafeEqual(password, env.ADMIN_PASSWORD!)
}

export async function mintAdminToken(
  env: { ADMIN_PASSWORD?: string },
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS
  const payload = `admin.${expiresAt}`
  const sig = await hmacHex(env.ADMIN_PASSWORD!, payload)
  return { token: `${payload}.${sig}`, expiresAt }
}

export async function verifyAdminToken(
  env: { ADMIN_PASSWORD?: string },
  token: string,
): Promise<boolean> {
  if (!adminConfigured(env) || !token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [kind, expStr, sig] = parts
  if (kind !== 'admin') return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const payload = `${kind}.${expStr}`
  const expected = await hmacHex(env.ADMIN_PASSWORD!, payload)
  return timingSafeEqual(sig, expected)
}

export function readAdminBearer(request: Request): string {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}
