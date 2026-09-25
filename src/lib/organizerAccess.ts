const ACCESS_KEY = 'round-organizer-access-v1'
const RSVP_KEY = 'round-my-rsvp-v1'

type AccessMap = Record<string, string>
type RsvpMap = Record<
  string,
  { attendeeId: string; email: string; guestKey?: string }
>

function loadAccessMap(): AccessMap {
  try {
    const raw = localStorage.getItem(ACCESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AccessMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAccessMap(map: AccessMap) {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(map))
}

export function normalizeOrganizerCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function formatOrganizerCode(code: string): string {
  const raw = normalizeOrganizerCode(code)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

export function loadOrganizerCode(gatheringId: string): string | null {
  const code = loadAccessMap()[gatheringId]
  return code ? formatOrganizerCode(code) : null
}

export function saveOrganizerCode(gatheringId: string, code: string) {
  const normalized = normalizeOrganizerCode(code)
  if (!gatheringId || !normalized) return
  const map = loadAccessMap()
  map[gatheringId] = normalized
  saveAccessMap(map)
}

export function forgetOrganizerCode(gatheringId: string) {
  const map = loadAccessMap()
  delete map[gatheringId]
  saveAccessMap(map)
}

function loadRsvpMap(): RsvpMap {
  try {
    const raw = localStorage.getItem(RSVP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RsvpMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function loadMyRsvp(
  gatheringId: string,
): { attendeeId: string; email: string; guestKey?: string } | null {
  const row = loadRsvpMap()[gatheringId]
  if (!row?.attendeeId) return null
  return row
}

export function saveMyRsvp(
  gatheringId: string,
  attendeeId: string,
  email: string,
  guestKey?: string,
) {
  const map = loadRsvpMap()
  map[gatheringId] = {
    attendeeId,
    email: email.trim().toLowerCase(),
    guestKey: guestKey || map[gatheringId]?.guestKey || '',
  }
  localStorage.setItem(RSVP_KEY, JSON.stringify(map))
}

export function clearMyRsvp(gatheringId: string) {
  const map = loadRsvpMap()
  delete map[gatheringId]
  localStorage.setItem(RSVP_KEY, JSON.stringify(map))
}
