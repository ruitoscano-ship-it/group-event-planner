import type { Gathering, OrganizerAccount } from '../types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const authApi = {
  status() {
    return request<{ configured: boolean }>('/api/auth/status')
  },
  me() {
    return request<{ user: OrganizerAccount }>('/api/me')
  },
  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
  },
  myGatherings() {
    return request<Gathering[]>('/api/me/gatherings')
  },
  claimGathering(gatheringId: string, code: string) {
    return request<{
      gathering: Gathering
      organizerCode: string
      claimed: boolean
    }>(`/api/gatherings/${encodeURIComponent(gatheringId)}/claim`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },
  googleStartUrl: '/api/auth/google/start',
}
