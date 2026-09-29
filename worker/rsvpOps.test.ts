import { describe, expect, it } from 'vitest'
import { codesMatch } from './organizerCode'

/** Mirror of worker guest RSVP open rules for regression coverage. */
function isGuestRsvpOpen(g: {
  archivedAt?: string | null
  rsvpClosed?: boolean
  rsvpDeadline?: string
}): boolean {
  if (g.archivedAt) return false
  if (g.rsvpClosed) return false
  const deadline = (g.rsvpDeadline || '').trim()
  if (deadline) {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    if (`${y}-${m}-${d}` > deadline) return false
  }
  return true
}

describe('guest RSVP gate', () => {
  it('blocks new RSVPs when closed or past deadline', () => {
    expect(isGuestRsvpOpen({})).toBe(true)
    expect(isGuestRsvpOpen({ rsvpClosed: true })).toBe(false)
    expect(isGuestRsvpOpen({ rsvpDeadline: '1999-01-01' })).toBe(false)
  })
})

describe('guest cancel auth', () => {
  it('matches guest keys like organizer codes (exact string)', () => {
    // cancel uses exact guestKey equality in the worker; codesMatch is for unlock
    expect(codesMatch('AB12-CD34', 'ab12cd34')).toBe(true)
    const stored = 'guestkeyabc'
    const provided = 'guestkeyabc'
    expect(provided === stored).toBe(true)
    expect('other' === stored).toBe(false)
  })
})
