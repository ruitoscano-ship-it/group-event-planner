import type {
  Attendee,
  CarteItem,
  Gathering,
  GatheringAccess,
  GatheringInput,
  MenuItem,
  MessageInput,
} from '../types'
import { loadOrganizerCode } from './organizerAccess'

async function request<T>(
  path: string,
  init?: RequestInit & { organizerCode?: string | null },
): Promise<T> {
  const { organizerCode, ...rest } = init ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }
  if (organizerCode) {
    headers['X-Organizer-Code'] = organizerCode
  }
  const res = await fetch(path, {
    ...rest,
    headers,
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

function withCode(gatheringId: string, code?: string | null) {
  return code ?? loadOrganizerCode(gatheringId)
}

export type AddAttendeeResult = {
  gathering: Gathering
  attendeeId: string
  updated: boolean
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
    return request<GatheringAccess>('/api/gatherings', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  accessByCode(code: string) {
    return request<GatheringAccess>('/api/access', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },
  unlockGathering(gatheringId: string, code: string) {
    return request<GatheringAccess>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/unlock`,
      { method: 'POST', body: JSON.stringify({ code }) },
    )
  },
  updateGathering(gathering: Gathering, organizerCode?: string | null) {
    return request<Gathering>(`/api/gatherings/${encodeURIComponent(gathering.id)}`, {
      method: 'PUT',
      body: JSON.stringify(gathering),
      organizerCode: withCode(gathering.id, organizerCode),
    })
  },
  deleteGathering(id: string, organizerCode?: string | null) {
    return request<{ ok: boolean }>(`/api/gatherings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      organizerCode: withCode(id, organizerCode),
    })
  },
  addMenuItem(
    gatheringId: string,
    item: Omit<MenuItem, 'id'>,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu`,
      {
        method: 'POST',
        body: JSON.stringify(item),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  setMenuCard(
    gatheringId: string,
    menuCardUrl: string,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu-card`,
      {
        method: 'PUT',
        body: JSON.stringify({ menuCardUrl }),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  setMenuCarte(
    gatheringId: string,
    items: CarteItem[],
    approved: boolean,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu-carte`,
      {
        method: 'PUT',
        body: JSON.stringify({ items, approved }),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  removeMenuItem(
    gatheringId: string,
    itemId: string,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/menu/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  addAttendee(
    gatheringId: string,
    attendee: Omit<Attendee, 'id' | 'createdAt' | 'amountPaid'> & {
      amountPaid?: number
    },
    organizerCode?: string | null,
  ) {
    return request<AddAttendeeResult>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees`,
      {
        method: 'POST',
        body: JSON.stringify(attendee),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  updateAttendee(
    gatheringId: string,
    attendeeId: string,
    patch: Partial<Attendee>,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees/${encodeURIComponent(attendeeId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  removeAttendee(
    gatheringId: string,
    attendeeId: string,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/attendees/${encodeURIComponent(attendeeId)}`,
      {
        method: 'DELETE',
        organizerCode: withCode(gatheringId, organizerCode),
      },
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
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
  deleteMessage(
    gatheringId: string,
    messageId: string,
    organizerCode?: string | null,
  ) {
    return request<Gathering>(
      `/api/gatherings/${encodeURIComponent(gatheringId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'DELETE',
        organizerCode: withCode(gatheringId, organizerCode),
      },
    )
  },
}
