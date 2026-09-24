import type { AgeGroup, GroupMember } from '../types'

const PREFS_KEY = 'round-guest-prefs-v1'
const draftKey = (eventId: string) => `round-rsvp-draft-v1:${eventId}`

export type GuestPrefs = {
  name?: string
  email?: string
  phone?: string
}

export type RsvpDraft = {
  name: string
  registeredBy: string
  forSomeoneElse: boolean
  asGroup: boolean
  members: GroupMember[]
  menuItemIds: string[]
  allergies: string
  email: string
  phone: string
  notes: string
  menuRequest: string
  ageGroup: AgeGroup
}

export function loadGuestPrefs(): GuestPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as GuestPrefs
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveGuestPrefs(prefs: GuestPrefs) {
  try {
    const current = loadGuestPrefs()
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        name: prefs.name ?? current.name ?? '',
        email: prefs.email ?? current.email ?? '',
        phone: prefs.phone ?? current.phone ?? '',
      }),
    )
  } catch {
    // ignore
  }
}

export function loadRsvpDraft(eventId: string): RsvpDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(eventId))
    if (!raw) return null
    return JSON.parse(raw) as RsvpDraft
  } catch {
    return null
  }
}

export function saveRsvpDraft(eventId: string, draft: RsvpDraft) {
  try {
    localStorage.setItem(draftKey(eventId), JSON.stringify(draft))
  } catch {
    // ignore quota
  }
}

export function clearRsvpDraft(eventId: string) {
  try {
    localStorage.removeItem(draftKey(eventId))
  } catch {
    // ignore
  }
}
