/** RSVP open/closed helpers. */

import type { Gathering } from '../types'

/** Today as YYYY-MM-DD in local timezone. */
export function todayLocalIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isRsvpOpen(
  gathering: Pick<Gathering, 'rsvpClosed' | 'rsvpDeadline' | 'archivedAt'>,
  now = new Date(),
): boolean {
  if (gathering.archivedAt) return false
  if (gathering.rsvpClosed) return false
  const deadline = (gathering.rsvpDeadline || '').trim()
  if (deadline && todayLocalIsoDate(now) > deadline) return false
  return true
}
