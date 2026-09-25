export type AdminStats = {
  total: number
  active: number
  archived: number
  past: number
  createdLast7Days: number
  attendeesTotal: number
  peopleTotal: number
}

export type AdminEventSummary = {
  id: string
  title: string
  type: string
  date: string
  time: string
  location: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  attendeeCount: number
  peopleCount: number
  messageCount: number
  menuCount: number
  organizerName: string
  organizerCode: string
  isPast: boolean
}

export type AdminFilter = 'all' | 'active' | 'archived' | 'past' | 'recent'

const TOKEN_KEY = 'round-admin-token-v1'

export function loadAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function adminRequest<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const { token, ...rest } = init ?? {}
  const auth = token === undefined ? loadAdminToken() : token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (auth) headers.Authorization = `Bearer ${auth}`

  const res = await fetch(path, { ...rest, headers })
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
  return (await res.json()) as T
}

export const adminApi = {
  login(password: string) {
    return adminRequest<{ token: string; expiresAt: number }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token: null,
    })
  },
  stats() {
    return adminRequest<AdminStats>('/api/admin/stats')
  },
  listEvents(filter: AdminFilter = 'all') {
    return adminRequest<{ events: AdminEventSummary[]; generatedAt: string }>(
      `/api/admin/events?filter=${encodeURIComponent(filter)}`,
    )
  },
  setArchived(id: string, archived: boolean) {
    return adminRequest<{ summary: AdminEventSummary }>(
      `/api/admin/events/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ archived }) },
    )
  },
  deleteEvent(id: string) {
    return adminRequest<{ ok: boolean; id: string }>(
      `/api/admin/events/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    )
  },
  purgePast(onlyArchived = true) {
    return adminRequest<{ deleted: number; matched: number }>(
      '/api/admin/events/purge-past',
      { method: 'POST', body: JSON.stringify({ onlyArchived }) },
    )
  },
}
