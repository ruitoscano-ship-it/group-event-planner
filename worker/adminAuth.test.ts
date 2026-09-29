import { describe, expect, it } from 'vitest'
import {
  adminConfigured,
  mintAdminToken,
  readAdminBearer,
  verifyAdminPassword,
  verifyAdminToken,
} from './adminAuth'

const env = { ADMIN_PASSWORD: 'super-secret-password' }

describe('admin auth', () => {
  it('requires a password of at least 8 characters', () => {
    expect(adminConfigured({})).toBe(false)
    expect(adminConfigured({ ADMIN_PASSWORD: 'short' })).toBe(false)
    expect(adminConfigured(env)).toBe(true)
  })

  it('verifies password with timing-safe compare', async () => {
    expect(await verifyAdminPassword(env, 'super-secret-password')).toBe(true)
    expect(await verifyAdminPassword(env, 'wrong-password!!!!')).toBe(false)
    expect(await verifyAdminPassword({}, 'super-secret-password')).toBe(false)
  })

  it('mints and verifies HMAC session tokens', async () => {
    const { token, expiresAt } = await mintAdminToken(env)
    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(await verifyAdminToken(env, token)).toBe(true)
    expect(await verifyAdminToken(env, 'admin.1.deadbeef')).toBe(false)
    expect(await verifyAdminToken(env, '')).toBe(false)
  })

  it('rejects expired tokens', async () => {
    const expired = `admin.${Date.now() - 1000}.fakesig`
    expect(await verifyAdminToken(env, expired)).toBe(false)
  })

  it('reads bearer tokens from Authorization', () => {
    const req = new Request('https://example.com', {
      headers: { Authorization: 'Bearer tok_abc' },
    })
    expect(readAdminBearer(req)).toBe('tok_abc')
    expect(readAdminBearer(new Request('https://example.com'))).toBe('')
  })
})
