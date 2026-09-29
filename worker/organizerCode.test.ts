import { describe, expect, it } from 'vitest'
import {
  codesMatch,
  formatOrganizerCode,
  generateOrganizerCode,
  normalizeOrganizerCode,
} from './organizerCode'

describe('organizer unlock codes', () => {
  it('normalizes and formats consistently', () => {
    expect(normalizeOrganizerCode(' ab12-cd34 ')).toBe('AB12CD34')
    expect(formatOrganizerCode('ab12cd34')).toBe('AB12-CD34')
    expect(codesMatch('ab12-cd34', 'AB12CD34')).toBe(true)
    expect(codesMatch('', 'AB12CD34')).toBe(false)
    expect(codesMatch('AAAA1111', 'BBBB2222')).toBe(false)
  })

  it('generates 8-char formatted codes from the safe alphabet', () => {
    const code = generateOrganizerCode()
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(code).not.toMatch(/[01IO]/)
  })
})
