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

/** True when this browser has never managed an event — launch assisted mode. */
export function shouldUseAssistedMode(): boolean {
  if (typeof localStorage === 'undefined') return false
  if (localStorage.getItem(ASSISTED_DONE_KEY) === '1') return false
  return !hasOrganizerHistory()
}

export function markAssistedComplete(): void {
  try {
    localStorage.setItem(ASSISTED_DONE_KEY, '1')
  } catch {
    // ignore
  }
}
