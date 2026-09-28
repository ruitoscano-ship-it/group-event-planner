const ASSISTED_DONE_KEY = 'round-assisted-first-event-done-v1'
const ACCESS_KEY = 'round-organizer-access-v1'

function hasOrganizerHistory(): boolean {
  try {
    const raw = localStorage.getItem(ACCESS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, string>
    return Boolean(parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0)
  } catch {
    return false
  }
}

export function isAssistedComplete(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ASSISTED_DONE_KEY) === '1'
}

/** True when this browser has never finished the organizer demo. */
export function shouldUseAssistedMode(): boolean {
  if (typeof localStorage === 'undefined') return false
  if (isAssistedComplete()) return false
  return !hasOrganizerHistory()
}

/** Start demo for first-time organizers even after they already have a code saved. */
export function shouldAutoStartOrganizerDemo(): boolean {
  if (typeof localStorage === 'undefined') return false
  return !isAssistedComplete()
}

export function markAssistedComplete(): void {
  try {
    localStorage.setItem(ASSISTED_DONE_KEY, '1')
  } catch {
    // ignore
  }
}

export function resetAssistedMode(): void {
  try {
    localStorage.removeItem(ASSISTED_DONE_KEY)
  } catch {
    // ignore
  }
}
