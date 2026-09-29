import { describe, expect, it } from 'vitest'
import {
  buildGoogleAuthUrl,
  clearSessionCookie,
  googleAuthConfigured,
  googleCallbackUrl,
  mintOAuthStateForRequest,
  mintSessionCookie,
  publicUser,
  readSessionUserId,
  verifyOAuthState,
  type OrganizerAuthEnv,
  type OrganizerUser,
} from './organizerAuth'

function mockEnv(overrides?: Partial<OrganizerAuthEnv>): OrganizerAuthEnv {
  return {
    DB: {} as D1Database,
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    ORGANIZER_SESSION_SECRET: 'session-secret-16+',
    ...overrides,
  }
}

/** Fetch forbids setting Cookie on Request; stub get() for worker cookie tests. */
function requestWithCookie(url: string, cookieHeader: string): Request {
  return {
    url,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'cookie') return cookieHeader
        return null
      },
    },
  } as Request
}

describe('google auth configuration', () => {
  it('requires client id, secret, and long session secret', () => {
    expect(googleAuthConfigured(mockEnv())).toBe(true)
    expect(
      googleAuthConfigured(mockEnv({ ORGANIZER_SESSION_SECRET: 'short' })),
    ).toBe(false)
    expect(googleAuthConfigured(mockEnv({ GOOGLE_CLIENT_ID: '' }))).toBe(false)
  })
})

describe('organizer session cookies', () => {
  it('mints a verifiable session for a user id', async () => {
    const env = mockEnv()
    const request = new Request('https://round.example/api/me')
    const { setCookieHeader } = await mintSessionCookie(env, request, 'usr_abc')
    expect(setCookieHeader).toContain('round_org_session=')
    expect(setCookieHeader).toContain('HttpOnly')
    expect(setCookieHeader).toContain('Secure')

    const cookie = setCookieHeader.split(';')[0]!
    const withCookie = requestWithCookie('https://round.example/api/me', cookie)
    expect(await readSessionUserId(env, withCookie)).toBe('usr_abc')
  })

  it('rejects tampered or missing sessions', async () => {
    const env = mockEnv()
    const request = new Request('https://round.example/api/me')
    expect(await readSessionUserId(env, request)).toBeNull()

    const bad = requestWithCookie(
      'https://round.example/api/me',
      'round_org_session=org.usr_abc.9999999999999.deadbeef',
    )
    expect(await readSessionUserId(env, bad)).toBeNull()
  })

  it('clears the session cookie', () => {
    const header = clearSessionCookie(new Request('https://round.example/'))
    expect(header).toContain('Max-Age=0')
    expect(header).toContain('round_org_session=')
  })
})

describe('oauth state', () => {
  it('mints state that must match cookie + signature', async () => {
    const env = mockEnv()
    const request = new Request('https://round.example/api/auth/google/start')
    const { state, setCookieHeader } = await mintOAuthStateForRequest(env, request)
    const cookie = setCookieHeader.split(';')[0]!
    const callback = requestWithCookie(
      'https://round.example/api/auth/google/callback?state=' + state,
      cookie,
    )
    expect(await verifyOAuthState(env, callback, state)).toBe(true)
    expect(await verifyOAuthState(env, callback, 'st.other.1.sig')).toBe(false)
  })
})

describe('google auth URL helpers', () => {
  it('builds callback and authorize URLs from request origin', () => {
    const env = mockEnv()
    const request = new Request('https://round.example/api/auth/google/start')
    expect(googleCallbackUrl(request)).toBe(
      'https://round.example/api/auth/google/callback',
    )
    const url = buildGoogleAuthUrl(env, request, 'state123')
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(
      true,
    )
    expect(url).toContain('client_id=client-id')
    expect(url).toContain('state=state123')
  })

  it('exposes only public user fields', () => {
    const user: OrganizerUser = {
      id: 'usr_1',
      googleSub: 'sub',
      email: 'a@b.com',
      name: 'A',
      pictureUrl: 'https://x',
      createdAt: 't1',
      updatedAt: 't2',
    }
    expect(publicUser(user)).toEqual({
      id: 'usr_1',
      email: 'a@b.com',
      name: 'A',
      pictureUrl: 'https://x',
    })
  })
})
