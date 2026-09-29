import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearMyRsvp,
  forgetOrganizerCode,
  formatOrganizerCode,
  loadMyRsvp,
  loadOrganizerCode,
  normalizeOrganizerCode,
  saveMyRsvp,
  saveOrganizerCode,
} from './organizerAccess'

describe('organizer code normalize/format', () => {
  it('strips punctuation and uppercases', () => {
    expect(normalizeOrganizerCode('ab12-cd34')).toBe('AB12CD34')
    expect(formatOrganizerCode('ab12cd34')).toBe('AB12-CD34')
    expect(formatOrganizerCode('AB12')).toBe('AB12')
  })
})

describe('organizer code localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves, loads formatted, and forgets codes per event', () => {
    saveOrganizerCode('evt1', 'ab12-cd34')
    expect(loadOrganizerCode('evt1')).toBe('AB12-CD34')
    expect(loadOrganizerCode('evt2')).toBeNull()
    forgetOrganizerCode('evt1')
    expect(loadOrganizerCode('evt1')).toBeNull()
  })

  it('ignores empty ids or codes', () => {
    saveOrganizerCode('', 'AB12CD34')
    saveOrganizerCode('evt1', '---')
    expect(loadOrganizerCode('evt1')).toBeNull()
  })
})

describe('RSVP memory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists attendee identity for an event', () => {
    saveMyRsvp('evt1', 'a1', 'Alex@Example.com', 'guestkey')
    expect(loadMyRsvp('evt1')).toEqual({
      attendeeId: 'a1',
      email: 'alex@example.com',
      guestKey: 'guestkey',
    })
    clearMyRsvp('evt1')
    expect(loadMyRsvp('evt1')).toBeNull()
  })
})
