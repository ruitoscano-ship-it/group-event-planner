/** Google OAuth + organizer session cookies. */

export type OrganizerUser = {
  id: string
  googleSub: string
  email: string
  name: string
  pictureUrl: string
  createdAt: string
  updatedAt: string
}

export type OrganizerAuthEnv = {
  DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  ORGANIZER_SESSION_SECRET?: string
}

const SESSION_COOKIE = 'round_org_session'
const STATE_COOKIE = 'round_oauth_state'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

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

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`
}

export function googleAuthConfigured(env: OrganizerAuthEnv): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.ORGANIZER_SESSION_SECRET &&
      env.ORGANIZER_SESSION_SECRET.length >= 16,
  )
}

function originFromRequest(request: Request): string {
  const url = new URL(request.url)
  return url.origin
}

export function googleCallbackUrl(request: Request): string {
  return `${originFromRequest(request)}/api/auth/google/callback`
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie') || ''
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

function cookieSecure(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

function setCookie(
  name: string,
  value: string,
  request: Request,
  maxAgeSec: number,
  httpOnly = true,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'SameSite=Lax',
  ]
  if (httpOnly) parts.push('HttpOnly')
  if (cookieSecure(request)) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie(name: string, request: Request): string {
  return setCookie(name, '', request, 0)
}

export async function mintOAuthStateForRequest(
  env: OrganizerAuthEnv,
  request: Request,
): Promise<{ state: string; setCookieHeader: string }> {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const exp = Date.now() + STATE_TTL_MS
  const payload = `st.${nonce}.${exp}`
  const sig = await hmacHex(env.ORGANIZER_SESSION_SECRET!, payload)
  const state = `${payload}.${sig}`
  return {
    state,
    setCookieHeader: setCookie(STATE_COOKIE, state, request, 600),
  }
}

export async function verifyOAuthState(
  env: OrganizerAuthEnv,
  request: Request,
  stateFromQuery: string,
): Promise<boolean> {
  const cookies = parseCookies(request)
  const fromCookie = cookies[STATE_COOKIE] || ''
  if (!stateFromQuery || !fromCookie || stateFromQuery !== fromCookie) return false
  const parts = stateFromQuery.split('.')
  if (parts.length !== 4) return false
  const [kind, nonce, expStr, sig] = parts
  if (kind !== 'st' || !nonce) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const payload = `${kind}.${nonce}.${expStr}`
  const expected = await hmacHex(env.ORGANIZER_SESSION_SECRET!, payload)
  return timingSafeEqual(sig, expected)
}

export function clearOAuthStateCookie(request: Request): string {
  return clearCookie(STATE_COOKIE, request)
}

export async function mintSessionCookie(
  env: OrganizerAuthEnv,
  request: Request,
  userId: string,
): Promise<{ setCookieHeader: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = `org.${userId}.${expiresAt}`
  const sig = await hmacHex(env.ORGANIZER_SESSION_SECRET!, payload)
  const token = `${payload}.${sig}`
  return {
    setCookieHeader: setCookie(
      SESSION_COOKIE,
      token,
      request,
      Math.floor(SESSION_TTL_MS / 1000),
    ),
    expiresAt,
  }
}

export function clearSessionCookie(request: Request): string {
  return clearCookie(SESSION_COOKIE, request)
}

export async function readSessionUserId(
  env: OrganizerAuthEnv,
  request: Request,
): Promise<string | null> {
  if (!googleAuthConfigured(env)) return null
  const token = parseCookies(request)[SESSION_COOKIE] || ''
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [kind, userId, expStr, sig] = parts
  if (kind !== 'org' || !userId) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return null
  const payload = `${kind}.${userId}.${expStr}`
  const expected = await hmacHex(env.ORGANIZER_SESSION_SECRET!, payload)
  if (!timingSafeEqual(sig, expected)) return null
  return userId
}

function mapUserRow(row: {
  id: string
  google_sub: string
  email: string
  name: string
  picture_url: string
  created_at: string
  updated_at: string
}): OrganizerUser {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    name: row.name || '',
    pictureUrl: row.picture_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<OrganizerUser | null> {
  const row = await db
    .prepare(
      'SELECT id, google_sub, email, name, picture_url, created_at, updated_at FROM users WHERE id = ?',
    )
    .bind(id)
    .first<{
      id: string
      google_sub: string
      email: string
      name: string
      picture_url: string
      created_at: string
      updated_at: string
    }>()
  return row ? mapUserRow(row) : null
}

export async function getSessionUser(
  env: OrganizerAuthEnv,
  request: Request,
): Promise<OrganizerUser | null> {
  const userId = await readSessionUserId(env, request)
  if (!userId) return null
  return getUserById(env.DB, userId)
}

export async function upsertGoogleUser(
  db: D1Database,
  profile: { sub: string; email: string; name: string; picture: string },
): Promise<OrganizerUser> {
  const now = new Date().toISOString()
  const existing = await db
    .prepare(
      'SELECT id, google_sub, email, name, picture_url, created_at, updated_at FROM users WHERE google_sub = ?',
    )
    .bind(profile.sub)
    .first<{
      id: string
      google_sub: string
      email: string
      name: string
      picture_url: string
      created_at: string
      updated_at: string
    }>()

  if (existing) {
    await db
      .prepare(
        'UPDATE users SET email = ?, name = ?, picture_url = ?, updated_at = ? WHERE id = ?',
      )
      .bind(profile.email, profile.name, profile.picture, now, existing.id)
      .run()
    return {
      id: existing.id,
      googleSub: existing.google_sub,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.picture,
      createdAt: existing.created_at,
      updatedAt: now,
    }
  }

  const id = newId('usr')
  await db
    .prepare(
      'INSERT INTO users (id, google_sub, email, name, picture_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, profile.sub, profile.email, profile.name, profile.picture, now, now)
    .run()
  return {
    id,
    googleSub: profile.sub,
    email: profile.email,
    name: profile.name,
    pictureUrl: profile.picture,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildGoogleAuthUrl(env: OrganizerAuthEnv, request: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleCallbackUrl(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGoogleCode(
  env: OrganizerAuthEnv,
  request: Request,
  code: string,
): Promise<{ sub: string; email: string; name: string; picture: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleCallbackUrl(request),
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    throw new Error('Google token exchange failed')
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) throw new Error('Google token missing')

  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  if (!profileRes.ok) throw new Error('Google profile fetch failed')
  const profile = (await profileRes.json()) as {
    sub?: string
    email?: string
    name?: string
    picture?: string
  }
  if (!profile.sub || !profile.email) throw new Error('Google profile incomplete')
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture || '',
  }
}

export function publicUser(user: OrganizerUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
  }
}
