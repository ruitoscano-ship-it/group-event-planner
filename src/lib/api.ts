import type {
  Attendee,
  Gathering,
  GatheringInput,
  MenuItem,
  MessageInput,
} from '../types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
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

export const api = {
  listGatherings(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([] as Gathering[])
    const q = encodeURIComponent(ids.join(','))
    return request<Gathering[]>(`/api/gatherings?ids=${q}`)
  },
  getGathering(id: string) {
    return request<Gathering>(`/api/gatherings/${encodeURIComponent(id)}`)
  },
  createGathering(input: GatheringInput) {
    return request<Gathering>('/api/gatherings', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  updateGathering(gathering: Gathering) {
    return request<Gathering>(`/api/gatherings/${encodeURIComponent(gathering.id)}`, {
      method: 'PUT',
      body: JSON.stringify(gathering),
    })
  },
  deleteGathering(id: string) {
    return request<{ ok: boolean }>(`/api/gatherings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
  addMenuItem(gatheringId: string, item: Omit<MenuItem, 'id'>) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu`,
      { method: 'POST', body: JSON.stringify(item) },
    )
  },
  setMenuCard(gatheringId: string, menuCardUrl: string) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu-card`,
      { method: 'PUT', body: JSON.stringify({ menuCardUrl }) },
    )
  },
  removeMenuItem(gatheringId: string, itemId: string) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
    )
  },
  addAttendee(
    gatheringId: string,
    attendee: Omit<Attendee, 'id' | 'createdAt' | 'amountPaid'> & {
      amountPaid?: number
    },
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees`,
      { method: 'POST', body: JSON.stringify(attendee) },
    )
  },
  updateAttendee(gatheringId: string, attendeeId: string, patch: Partial<Attendee>) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees/${encodeURIComponent(attendeeId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
  },
  removeAttendee(gatheringId: string, attendeeId: string) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees/${encodeURIComponent(attendeeId)}`,
      { method: 'DELETE' },
    )
  },
  sendMessage(gatheringId: string, message: MessageInput) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/messages`,
      { method: 'POST', body: JSON.stringify(message) },
    )
  },
  updateMessage(
    gatheringId: string,
    messageId: string,
    patch: { read?: boolean },
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
  },
  deleteMessage(gatheringId: string, messageId: string) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    )
  },
}
