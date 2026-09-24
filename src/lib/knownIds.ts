const KNOWN_IDS_KEY = 'round-known-gathering-ids-v1'

export function loadKnownIds(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveKnownIds(ids: string[]): void {
  localStorage.setItem(KNOWN_IDS_KEY, JSON.stringify([...new Set(ids)]))
}

export function rememberGatheringId(id: string): void {
  const ids = loadKnownIds()
  if (!ids.includes(id)) {
    saveKnownIds([id, ...ids])
  }
}

export function forgetGatheringId(id: string): void {
  saveKnownIds(loadKnownIds().filter((x) => x !== id))
}
