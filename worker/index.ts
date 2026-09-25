import type {
  Attendee,
  Env,
  Gathering,
  GatheringInput,
  InboxMessage,
  MenuItem,
  MessageInput,
} from './types'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function normalizeGathering(raw: Gathering & { menuOcrLines?: string[] }): Gathering {
  const legacyLines = Array.isArray(raw.menuOcrLines)
    ? raw.menuOcrLines.map((line) => String(line || '').trim()).filter(Boolean)
    : []
  const carteItems = Array.isArray(raw.carteItems)
    ? raw.carteItems
        .map((item) => ({
          id: item.id || newId('carte'),
          name: String(item.name || '').trim(),
        }))
        .filter((item) => item.name)
        .slice(0, 120)
    : legacyLines.map((name) => ({ id: newId('carte'), name })).slice(0, 120)

  return {
    ...raw,
    menuCardUrl: raw.menuCardUrl || '',
    carteItems,
    carteApproved: Boolean(raw.carteApproved) && carteItems.length > 0,
    organizerName: (raw.organizerName || '').trim(),
    organizerEmail: (raw.organizerEmail || '').trim(),
    organizerPhone: (raw.organizerPhone || '').trim(),
    menu: (raw.menu || []).map((m) => ({
      ...m,
      isAlaCarte: Boolean(m.isAlaCarte),
      price: m.isAlaCarte ? 0 : Number(m.price) || 0,
    })),
    attendees: (raw.attendees || []).map((a) => {
      const members = Array.isArray(a.members)
        ? a.members.map((m) => ({
            id: m.id || newId('m'),
            name: (m.name || '').trim(),
            menuItemIds: Array.isArray(m.menuItemIds) ? m.menuItemIds : [],
            carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
            allergies: (m.allergies || '').trim(),
            menuRequest: (m.menuRequest || '').trim(),
            ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
          }))
        : []
      const isGroup = Boolean(a.isGroup)
      return {
        ...a,
        email: (a.email || '').trim(),
        phone: (a.phone || '').trim(),
        menuRequest: (a.menuRequest || '').trim(),
        carteItemIds: Array.isArray(a.carteItemIds) ? a.carteItemIds : [],
        ageGroup: a.ageGroup === 'child' ? 'child' : 'adult',
        isGroup,
        members,
        groupSize: isGroup
          ? Math.max(1, members.length || Number(a.groupSize) || 1)
          : 1,
      }
    }),
    messages: Array.isArray(raw.messages)
      ? raw.messages.map((m) => ({
          id: m.id || newId('msg'),
          fromName: (m.fromName || '').trim(),
          fromEmail: (m.fromEmail || '').trim(),
          fromPhone: (m.fromPhone || '').trim(),
          body: (m.body || '').trim(),
          createdAt: m.createdAt || new Date().toISOString(),
          read: Boolean(m.read),
        }))
      : [],
  }
}

async function readGathering(db: D1Database, id: string): Promise<Gathering | null> {
  const row = await db
    .prepare('SELECT data FROM gatherings WHERE id = ?')
    .bind(id)
    .first<{ data: string }>()
  if (!row) return null
  try {
    return normalizeGathering(JSON.parse(row.data) as Gathering)
  } catch {
    return null
  }
}

async function writeGathering(db: D1Database, gathering: Gathering, isNew: boolean) {
  const now = new Date().toISOString()
  const normalized = normalizeGathering(gathering)
  const payload = JSON.stringify(normalized)
  if (isNew) {
    await db
      .prepare(
        'INSERT INTO gatherings (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .bind(normalized.id, payload, normalized.createdAt || now, now)
      .run()
  } else {
    await db
      .prepare('UPDATE gatherings SET data = ?, updated_at = ? WHERE id = ?')
      .bind(payload, now, normalized.id)
      .run()
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 })
    }

    try {
      return await handleApi(request, env, url)
    } catch (err) {
      console.error('API error', err)
      return error('Internal server error', 500)
    }
  },
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/$/, '') || '/'
  const method = request.method

  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true })
  }

  if (path === '/api/gatherings' && method === 'GET') {
    const idsParam = url.searchParams.get('ids')
    if (!idsParam) return json([])
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50)
    if (ids.length === 0) return json([])

    const placeholders = ids.map(() => '?').join(',')
    const { results } = await env.DB.prepare(
      `SELECT data FROM gatherings WHERE id IN (${placeholders}) ORDER BY updated_at DESC`,
    )
      .bind(...ids)
      .all<{ data: string }>()

    const gatherings = (results ?? [])
      .map((row) => {
        try {
          return normalizeGathering(JSON.parse(row.data) as Gathering)
        } catch {
          return null
        }
      })
      .filter((g): g is Gathering => g !== null)

    return json(gatherings)
  }

  if (path === '/api/gatherings' && method === 'POST') {
    const body = (await request.json()) as GatheringInput
    if (!body?.title?.trim()) return error('Title is required')

    const now = new Date().toISOString()
    const gathering: Gathering = {
      id: newId('evt'),
      title: body.title.trim(),
      type: body.type || 'lunch',
      date: body.date || '',
      time: body.time || '',
      location: (body.location || '').trim(),
      notes: (body.notes || '').trim(),
      currency: body.currency || 'EUR',
      organizerName: (body.organizerName || '').trim(),
      organizerEmail: (body.organizerEmail || '').trim(),
      organizerPhone: (body.organizerPhone || '').trim(),
      menuCardUrl: (body.menuCardUrl || '').trim(),
      carteItems: [],
      carteApproved: false,
      menu: [],
      attendees: [],
      messages: [],
      createdAt: now,
    }
    await writeGathering(env.DB, gathering, true)
    return json(gathering, 201)
  }

  const gatheringMatch = path.match(/^\/api\/gatherings\/([^/]+)$/)
  if (gatheringMatch) {
    const id = decodeURIComponent(gatheringMatch[1])

    if (method === 'GET') {
      const gathering = await readGathering(env.DB, id)
      if (!gathering) return error('Gathering not found', 404)
      return json(gathering)
    }

    if (method === 'PUT') {
      const body = (await request.json()) as Gathering
      if (!body || body.id !== id) return error('Invalid gathering payload')
      const existing = await readGathering(env.DB, id)
      if (!existing) return error('Gathering not found', 404)
      const next: Gathering = {
        ...existing,
        ...body,
        id,
        organizerName:
          typeof body.organizerName === 'string'
            ? body.organizerName.trim()
            : existing.organizerName,
        organizerEmail:
          typeof body.organizerEmail === 'string'
            ? body.organizerEmail.trim()
            : existing.organizerEmail,
        organizerPhone:
          typeof body.organizerPhone === 'string'
            ? body.organizerPhone.trim()
            : existing.organizerPhone,
        menuCardUrl:
          typeof body.menuCardUrl === 'string' ? body.menuCardUrl.trim() : existing.menuCardUrl,
        menu: Array.isArray(body.menu) ? body.menu : existing.menu,
        attendees: Array.isArray(body.attendees) ? body.attendees : existing.attendees,
        messages: Array.isArray(body.messages) ? body.messages : existing.messages,
        createdAt: existing.createdAt,
      }
      await writeGathering(env.DB, next, false)
      return json(next)
    }

    if (method === 'DELETE') {
      const result = await env.DB.prepare('DELETE FROM gatherings WHERE id = ?')
        .bind(id)
        .run()
      if (!result.meta.changes) return error('Gathering not found', 404)
      return json({ ok: true })
    }
  }

  const menuCardMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu-card$/)
  if (menuCardMatch && method === 'PUT') {
    const id = decodeURIComponent(menuCardMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as { menuCardUrl?: string }
    const urlValue = (body.menuCardUrl || '').trim()
    if (urlValue.startsWith('data:') && urlValue.length > 700_000) {
      return error('Image is too large. Use a smaller file or a link.', 413)
    }
    gathering.menuCardUrl = urlValue
    if (!urlValue) {
      gathering.carteItems = []
      gathering.carteApproved = false
    }
    await writeGathering(env.DB, gathering, false)
    return json(gathering)
  }

  const menuCarteMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu-carte$/)
  if (menuCarteMatch && method === 'PUT') {
    const id = decodeURIComponent(menuCarteMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as {
      items?: unknown
      approved?: unknown
    }
    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => {
            const row = item as { id?: string; name?: string }
            const name = String(row?.name || '').trim()
            if (!name || name.length > 120) return null
            return {
              id: row.id || newId('carte'),
              name,
            }
          })
          .filter((item): item is { id: string; name: string } => item !== null)
          .slice(0, 120)
      : gathering.carteItems
    gathering.carteItems = items
    gathering.carteApproved = Boolean(body.approved) && items.length > 0
    await writeGathering(env.DB, gathering, false)
    return json(gathering)
  }

  const menuMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu$/)
  if (menuMatch && method === 'POST') {
    const id = decodeURIComponent(menuMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as Omit<MenuItem, 'id'>
    if (!body?.name?.trim()) return error('Menu item name is required')
    const isAlaCarte = Boolean(body.isAlaCarte)
    const item: MenuItem = {
      id: newId('menu'),
      name: body.name.trim(),
      description: (body.description || '').trim(),
      price: isAlaCarte ? 0 : Number(body.price) || 0,
      category: (body.category || 'Mains').trim() || 'Mains',
      isAlaCarte,
    }
    gathering.menu.push(item)
    await writeGathering(env.DB, gathering, false)
    return json(gathering, 201)
  }

  const menuItemMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu\/([^/]+)$/)
  if (menuItemMatch && method === 'DELETE') {
    const id = decodeURIComponent(menuItemMatch[1])
    const itemId = decodeURIComponent(menuItemMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    gathering.menu = gathering.menu.filter((m) => m.id !== itemId)
    gathering.attendees = gathering.attendees.map((a) => ({
      ...a,
      menuItemIds: a.menuItemIds.filter((mid) => mid !== itemId),
      members: (a.members || []).map((m) => ({
        ...m,
        menuItemIds: m.menuItemIds.filter((mid) => mid !== itemId),
      })),
    }))
    await writeGathering(env.DB, gathering, false)
    return json(gathering)
  }

  const attendeesMatch = path.match(/^\/api\/gatherings\/([^/]+)\/attendees$/)
  if (attendeesMatch && method === 'POST') {
    const id = decodeURIComponent(attendeesMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as Omit<Attendee, 'id' | 'createdAt' | 'amountPaid'> & {
      amountPaid?: number
    }
    if (!body?.name?.trim()) return error('Guest name is required')
    const isGroup = Boolean(body.isGroup)
    const members = isGroup && Array.isArray(body.members)
      ? body.members.map((m) => ({
          id: m.id || newId('m'),
          name: (m.name || '').trim(),
          menuItemIds: Array.isArray(m.menuItemIds) ? m.menuItemIds : [],
          carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
          allergies: (m.allergies || '').trim(),
          menuRequest: (m.menuRequest || '').trim(),
          ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
        }))
      : []
    if (isGroup && members.length === 0) {
      return error('Add at least one group member with a menu choice')
    }
    const attendee: Attendee = {
      id: newId('guest'),
      name: body.name.trim(),
      registeredBy: (body.registeredBy || body.name).trim(),
      email: (body.email || '').trim(),
      phone: (body.phone || '').trim(),
      menuItemIds: isGroup
        ? []
        : Array.isArray(body.menuItemIds)
          ? body.menuItemIds
          : [],
      carteItemIds: isGroup
        ? []
        : Array.isArray(body.carteItemIds)
          ? body.carteItemIds
          : [],
      allergies: (body.allergies || '').trim(),
      notes: (body.notes || '').trim(),
      menuRequest: isGroup ? '' : (body.menuRequest || '').trim(),
      ageGroup: isGroup ? 'adult' : body.ageGroup === 'child' ? 'child' : 'adult',
      amountPaid: Number(body.amountPaid) || 0,
      createdAt: new Date().toISOString(),
      isGroup,
      members,
      groupSize: isGroup ? Math.max(1, members.length) : 1,
    }
    gathering.attendees.push(attendee)
    await writeGathering(env.DB, gathering, false)
    return json(gathering, 201)
  }

  const attendeeMatch = path.match(/^\/api\/gatherings\/([^/]+)\/attendees\/([^/]+)$/)
  if (attendeeMatch) {
    const id = decodeURIComponent(attendeeMatch[1])
    const attendeeId = decodeURIComponent(attendeeMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)

    if (method === 'PATCH') {
      const body = (await request.json()) as Partial<Attendee>
      const idx = gathering.attendees.findIndex((a) => a.id === attendeeId)
      if (idx === -1) return error('Attendee not found', 404)
      const current = gathering.attendees[idx]
      const members =
        body.members !== undefined
          ? Array.isArray(body.members)
            ? body.members.map((m) => ({
                id: m.id || newId('m'),
                name: (m.name || '').trim(),
                menuItemIds: Array.isArray(m.menuItemIds) ? m.menuItemIds : [],
                carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds : [],
                allergies: (m.allergies || '').trim(),
                menuRequest: (m.menuRequest || '').trim(),
                ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
              }))
            : []
          : current.members || []
      const isGroup =
        body.isGroup !== undefined ? Boolean(body.isGroup) : current.isGroup
      gathering.attendees[idx] = {
        ...current,
        ...body,
        id: attendeeId,
        email:
          body.email !== undefined ? String(body.email).trim() : current.email,
        phone:
          body.phone !== undefined ? String(body.phone).trim() : current.phone,
        menuRequest:
          body.menuRequest !== undefined
            ? String(body.menuRequest).trim()
            : current.menuRequest || '',
        carteItemIds:
          body.carteItemIds !== undefined
            ? Array.isArray(body.carteItemIds)
              ? body.carteItemIds
              : []
            : current.carteItemIds || [],
        ageGroup:
          body.ageGroup !== undefined
            ? body.ageGroup === 'child'
              ? 'child'
              : 'adult'
            : current.ageGroup || 'adult',
        isGroup,
        members: isGroup ? members : [],
        groupSize: isGroup ? Math.max(1, members.length || Number(body.groupSize) || 1) : 1,
      }
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }

    if (method === 'DELETE') {
      gathering.attendees = gathering.attendees.filter((a) => a.id !== attendeeId)
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }
  }

  const messagesMatch = path.match(/^\/api\/gatherings\/([^/]+)\/messages$/)
  if (messagesMatch && method === 'POST') {
    const id = decodeURIComponent(messagesMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as MessageInput
    if (!body?.fromName?.trim()) return error('Your name is required')
    if (!body?.body?.trim()) return error('Message is required')
    const message: InboxMessage = {
      id: newId('msg'),
      fromName: body.fromName.trim(),
      fromEmail: (body.fromEmail || '').trim(),
      fromPhone: (body.fromPhone || '').trim(),
      body: body.body.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
      read: false,
    }
    gathering.messages = [message, ...(gathering.messages || [])]
    await writeGathering(env.DB, gathering, false)
    return json(gathering, 201)
  }

  const messageMatch = path.match(/^\/api\/gatherings\/([^/]+)\/messages\/([^/]+)$/)
  if (messageMatch) {
    const id = decodeURIComponent(messageMatch[1])
    const messageId = decodeURIComponent(messageMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const idx = (gathering.messages || []).findIndex((m) => m.id === messageId)
    if (idx === -1) return error('Message not found', 404)

    if (method === 'PATCH') {
      const body = (await request.json()) as Partial<InboxMessage>
      gathering.messages[idx] = {
        ...gathering.messages[idx],
        read: body.read !== undefined ? Boolean(body.read) : gathering.messages[idx].read,
      }
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }

    if (method === 'DELETE') {
      gathering.messages = gathering.messages.filter((m) => m.id !== messageId)
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }
  }

  return error('Not found', 404)
}
