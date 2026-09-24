import type { Attendee, Env, Gathering, GatheringInput, MenuItem } from './types'

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

async function readGathering(db: D1Database, id: string): Promise<Gathering | null> {
  const row = await db
    .prepare('SELECT data FROM gatherings WHERE id = ?')
    .bind(id)
    .first<{ data: string }>()
  if (!row) return null
  try {
    return JSON.parse(row.data) as Gathering
  } catch {
    return null
  }
}

async function writeGathering(db: D1Database, gathering: Gathering, isNew: boolean) {
  const now = new Date().toISOString()
  const payload = JSON.stringify(gathering)
  if (isNew) {
    await db
      .prepare(
        'INSERT INTO gatherings (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .bind(gathering.id, payload, gathering.createdAt || now, now)
      .run()
  } else {
    await db
      .prepare('UPDATE gatherings SET data = ?, updated_at = ? WHERE id = ?')
      .bind(payload, now, gathering.id)
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
          return JSON.parse(row.data) as Gathering
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
      menu: [],
      attendees: [],
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
        menu: Array.isArray(body.menu) ? body.menu : existing.menu,
        attendees: Array.isArray(body.attendees) ? body.attendees : existing.attendees,
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

  const menuMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu$/)
  if (menuMatch && method === 'POST') {
    const id = decodeURIComponent(menuMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const body = (await request.json()) as Omit<MenuItem, 'id'>
    if (!body?.name?.trim()) return error('Menu item name is required')
    const item: MenuItem = {
      id: newId('menu'),
      name: body.name.trim(),
      description: (body.description || '').trim(),
      price: Number(body.price) || 0,
      category: (body.category || 'Mains').trim() || 'Mains',
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
    const attendee: Attendee = {
      id: newId('guest'),
      name: body.name.trim(),
      registeredBy: (body.registeredBy || body.name).trim(),
      menuItemIds: Array.isArray(body.menuItemIds) ? body.menuItemIds : [],
      allergies: (body.allergies || '').trim(),
      notes: (body.notes || '').trim(),
      amountPaid: Number(body.amountPaid) || 0,
      createdAt: new Date().toISOString(),
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
      gathering.attendees[idx] = { ...gathering.attendees[idx], ...body, id: attendeeId }
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }

    if (method === 'DELETE') {
      gathering.attendees = gathering.attendees.filter((a) => a.id !== attendeeId)
      await writeGathering(env.DB, gathering, false)
      return json(gathering)
    }
  }

  return error('Not found', 404)
}
