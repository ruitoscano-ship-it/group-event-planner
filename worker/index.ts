import type {
  Attendee,
  Env,
  Gathering,
  GatheringInput,
  InboxMessage,
  MenuItem,
  MessageInput,
} from './types'

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

const MAX_JSON_BYTES = 900_000
const MAX_TEXT = 500
const MAX_NOTES = 2000
const MAX_MESSAGE = 2000
const MAX_NAME = 120
const MAX_ATTENDEES = 200
const MAX_MESSAGES = 100
const MAX_MENU_ITEMS = 80

/** Best-effort in-isolate rate limit (resets when isolate recycles). */
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: SECURITY_HEADERS,
  })
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}

function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function rateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): Response | null {
  const key = `${bucket}:${clientIp(request)}`
  const now = Date.now()
  const current = rateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  current.count += 1
  if (current.count > limit) {
    return error('Too many requests. Try again shortly.', 429)
  }
  return null
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function newGuestKey(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function normalizeOrganizerCode(code: string): string {
  return String(code || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

function formatOrganizerCode(code: string): string {
  const raw = normalizeOrganizerCode(code)
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

function generateOrganizerCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let raw = ''
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return formatOrganizerCode(raw)
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

function clip(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

/** Allow https/http image links or data:image/*;block javascript: and odd schemes. */
function sanitizeMenuCardUrl(raw: string): string | { error: string } {
  const urlValue = String(raw || '').trim()
  if (!urlValue) return ''
  if (urlValue.startsWith('data:')) {
    if (urlValue.length > 700_000) {
      return { error: 'Image is too large. Use a smaller file or a link.' }
    }
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(urlValue)) {
      return { error: 'Only JPEG, PNG, WebP, or GIF images are allowed.' }
    }
    return urlValue
  }
  try {
    const parsed = new URL(urlValue)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { error: 'Menu card link must be http(s).' }
    }
    if (parsed.username || parsed.password) {
      return { error: 'Menu card link cannot include credentials.' }
    }
    return parsed.toString()
  } catch {
    return { error: 'Invalid menu card link.' }
  }
}

function readOrganizerCodeHeader(request: Request): string {
  return normalizeOrganizerCode(request.headers.get('X-Organizer-Code') || '')
}

function isOrganizerAuthorized(request: Request, gathering: Gathering): boolean {
  const stored = normalizeOrganizerCode(gathering.organizerCode || '')
  // No code on record: not authorized until unlock assigns one
  if (!stored) return false
  const provided = readOrganizerCodeHeader(request)
  return Boolean(provided) && provided === stored
}

function requireOrganizer(request: Request, gathering: Gathering): Response | null {
  if (isOrganizerAuthorized(request, gathering)) return null
  return error('Organizer code required', 401)
}

type PublicAttendee = Pick<
  Attendee,
  'id' | 'name' | 'isGroup' | 'groupSize' | 'createdAt'
> & {
  members: Array<Pick<Attendee['members'][number], 'id' | 'name'>>
  email?: undefined
  phone?: undefined
  allergies?: undefined
  notes?: undefined
  menuItemIds?: undefined
  carteItemIds?: undefined
  menuRequest?: undefined
  amountPaid?: undefined
  registeredBy?: undefined
  guestKey?: undefined
}

function toPublicAttendees(attendees: Attendee[]): PublicAttendee[] {
  return (attendees || []).map((a) => ({
    id: a.id,
    name: a.name,
    isGroup: Boolean(a.isGroup),
    groupSize: a.isGroup
      ? Math.max(1, a.members?.length || Number(a.groupSize) || 1)
      : 1,
    createdAt: a.createdAt,
    members: (a.members || []).map((m) => ({
      id: m.id,
      name: m.name,
    })),
  }))
}

/** Full payload for organizers; redacted for guests / anonymous. */
function toClientGathering(
  gathering: Gathering,
  authorized: boolean,
): Omit<Gathering, 'organizerCode'> & { organizerCode?: undefined } {
  const { organizerCode: _code, ...rest } = gathering
  if (authorized) {
    return {
      ...rest,
      // Never echo the manage code in JSON bodies
      organizerCode: undefined,
    }
  }
  return {
    ...rest,
    organizerCode: undefined,
    organizerEmail: '',
    organizerPhone: '',
    messages: [],
    attendees: toPublicAttendees(rest.attendees) as unknown as Attendee[],
  }
}

function normalizeGathering(raw: Gathering & { menuOcrLines?: string[] }): Gathering {
  const legacyLines = Array.isArray(raw.menuOcrLines)
    ? raw.menuOcrLines.map((line) => String(line || '').trim()).filter(Boolean)
    : []
  const carteItems = Array.isArray(raw.carteItems)
    ? raw.carteItems
        .map((item) => ({
          id: item.id || newId('carte'),
          name: clip(item.name, MAX_NAME),
        }))
        .filter((item) => item.name)
        .slice(0, 120)
    : legacyLines.map((name) => ({ id: newId('carte'), name: clip(name, MAX_NAME) })).slice(0, 120)

  return {
    ...raw,
    title: clip(raw.title, MAX_NAME) || 'Gathering',
    location: clip(raw.location, MAX_TEXT),
    notes: clip(raw.notes, MAX_NOTES),
    menuCardUrl: raw.menuCardUrl || '',
    organizerCode: formatOrganizerCode(raw.organizerCode || '') || '',
    carteItems,
    carteApproved: Boolean(raw.carteApproved) && carteItems.length > 0,
    organizerName: clip(raw.organizerName, MAX_NAME),
    organizerEmail: clip(raw.organizerEmail, MAX_TEXT),
    organizerPhone: clip(raw.organizerPhone, 40),
    menu: (raw.menu || []).slice(0, MAX_MENU_ITEMS).map((m) => ({
      ...m,
      name: clip(m.name, MAX_NAME),
      description: clip(m.description, MAX_TEXT),
      category: clip(m.category, 60) || 'Mains',
      isAlaCarte: Boolean(m.isAlaCarte),
      price: m.isAlaCarte ? 0 : Math.max(0, Number(m.price) || 0),
    })),
    attendees: (raw.attendees || []).slice(0, MAX_ATTENDEES).map((a) => {
      const members = Array.isArray(a.members)
        ? a.members.slice(0, 30).map((m) => ({
            id: m.id || newId('m'),
            name: clip(m.name, MAX_NAME),
            menuItemIds: Array.isArray(m.menuItemIds) ? m.menuItemIds.slice(0, 40) : [],
            carteItemIds: Array.isArray(m.carteItemIds) ? m.carteItemIds.slice(0, 40) : [],
            allergies: clip(m.allergies, MAX_TEXT),
            menuRequest: clip(m.menuRequest, MAX_NOTES),
            ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
          }))
        : []
      const isGroup = Boolean(a.isGroup)
      return {
        ...a,
        name: clip(a.name, MAX_NAME),
        registeredBy: clip(a.registeredBy, MAX_NAME),
        email: clip(a.email, MAX_TEXT),
        phone: clip(a.phone, 40),
        menuRequest: clip(a.menuRequest, MAX_NOTES),
        allergies: clip(a.allergies, MAX_TEXT),
        notes: clip(a.notes, MAX_NOTES),
        carteItemIds: Array.isArray(a.carteItemIds) ? a.carteItemIds.slice(0, 40) : [],
        menuItemIds: Array.isArray(a.menuItemIds) ? a.menuItemIds.slice(0, 40) : [],
        ageGroup: a.ageGroup === 'child' ? 'child' : 'adult',
        amountPaid: Math.max(0, Number(a.amountPaid) || 0),
        guestKey: a.guestKey || '',
        isGroup,
        members,
        groupSize: isGroup
          ? Math.max(1, members.length || Number(a.groupSize) || 1)
          : 1,
      }
    }),
    messages: Array.isArray(raw.messages)
      ? raw.messages.slice(0, MAX_MESSAGES).map((m) => ({
          id: m.id || newId('msg'),
          fromName: clip(m.fromName, MAX_NAME),
          fromEmail: clip(m.fromEmail, MAX_TEXT),
          fromPhone: clip(m.fromPhone, 40),
          body: clip(m.body, MAX_MESSAGE),
          createdAt: m.createdAt || new Date().toISOString(),
          read: Boolean(m.read),
        }))
      : [],
  }
}

async function findGatheringByOrganizerCode(
  db: D1Database,
  code: string,
): Promise<Gathering | null> {
  const needle = normalizeOrganizerCode(code)
  if (!needle || needle.length < 6) return null
  const { results } = await db
    .prepare('SELECT data FROM gatherings ORDER BY updated_at DESC LIMIT 200')
    .all<{ data: string }>()
  for (const row of results ?? []) {
    try {
      const gathering = normalizeGathering(JSON.parse(row.data) as Gathering)
      if (normalizeOrganizerCode(gathering.organizerCode) === needle) {
        return gathering
      }
    } catch {
      // skip bad rows
    }
  }
  return null
}

async function readGathering(db: D1Database, id: string): Promise<Gathering | null> {
  if (!id || id.length > 80) return null
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
  if (payload.length > 2_500_000) {
    throw new Error('Gathering payload too large')
  }
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

async function readJsonBody<T>(request: Request): Promise<T | Response> {
  const length = Number(request.headers.get('Content-Length') || 0)
  if (length > MAX_JSON_BYTES) {
    return error('Request body too large', 413)
  }
  try {
    return (await request.json()) as T
  } catch {
    return error('Invalid JSON body')
  }
}

function normalizeMembers(
  raw: unknown,
): Attendee['members'] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 30).map((m) => {
    const row = m as Attendee['members'][number]
    return {
      id: row.id || newId('m'),
      name: clip(row.name, MAX_NAME),
      menuItemIds: Array.isArray(row.menuItemIds) ? row.menuItemIds.slice(0, 40) : [],
      carteItemIds: Array.isArray(row.carteItemIds) ? row.carteItemIds.slice(0, 40) : [],
      allergies: clip(row.allergies, MAX_TEXT),
      menuRequest: clip(row.menuRequest, MAX_NOTES),
      ageGroup: row.ageGroup === 'child' ? 'child' : 'adult',
    }
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...SECURITY_HEADERS,
          Allow: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        },
      })
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
          const gathering = normalizeGathering(JSON.parse(row.data) as Gathering)
          // List endpoint is unauthenticated — always redact PII
          return toClientGathering(gathering, false)
        } catch {
          return null
        }
      })
      .filter((g): g is ReturnType<typeof toClientGathering> => g !== null)

    return json(gatherings)
  }

  if (path === '/api/access' && method === 'POST') {
    const limited = rateLimit(request, 'access', 20, 60_000)
    if (limited) return limited
    const bodyOrErr = await readJsonBody<{ code?: string }>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const code = normalizeOrganizerCode(bodyOrErr.code || '')
    if (code.length < 6) return error('Organizer code is required')
    const gathering = await findGatheringByOrganizerCode(env.DB, code)
    if (!gathering) return error('No event found for that code', 404)
    return json({
      gathering: toClientGathering(gathering, true),
      organizerCode: formatOrganizerCode(gathering.organizerCode),
    })
  }

  if (path === '/api/gatherings' && method === 'POST') {
    const limited = rateLimit(request, 'create', 10, 60_000)
    if (limited) return limited
    const bodyOrErr = await readJsonBody<GatheringInput>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const body = bodyOrErr
    if (!body?.title?.trim()) return error('Title is required')

    const card = sanitizeMenuCardUrl(body.menuCardUrl || '')
    if (typeof card === 'object') return error(card.error, 400)

    const now = new Date().toISOString()
    const organizerCode = generateOrganizerCode()
    const gathering: Gathering = {
      id: newId('evt'),
      title: clip(body.title, MAX_NAME),
      type: body.type || 'lunch',
      date: clip(body.date, 32),
      time: clip(body.time, 16),
      location: clip(body.location, MAX_TEXT),
      notes: clip(body.notes, MAX_NOTES),
      currency: clip(body.currency, 8) || 'EUR',
      organizerName: clip(body.organizerName, MAX_NAME),
      organizerEmail: clip(body.organizerEmail, MAX_TEXT),
      organizerPhone: clip(body.organizerPhone, 40),
      organizerCode,
      menuCardUrl: card,
      carteItems: [],
      carteApproved: false,
      menu: [],
      attendees: [],
      messages: [],
      createdAt: now,
    }
    await writeGathering(env.DB, gathering, true)
    return json(
      {
        gathering: toClientGathering(gathering, true),
        organizerCode,
      },
      201,
    )
  }

  const gatheringMatch = path.match(/^\/api\/gatherings\/([^/]+)$/)
  if (gatheringMatch) {
    const id = decodeURIComponent(gatheringMatch[1])

    if (method === 'GET') {
      const gathering = await readGathering(env.DB, id)
      if (!gathering) return error('Gathering not found', 404)
      const authorized = isOrganizerAuthorized(request, gathering)
      return json(toClientGathering(gathering, authorized))
    }

    if (method === 'PUT') {
      const existing = await readGathering(env.DB, id)
      if (!existing) return error('Gathering not found', 404)
      const denied = requireOrganizer(request, existing)
      if (denied) return denied
      const bodyOrErr = await readJsonBody<Partial<Gathering>>(request)
      if (bodyOrErr instanceof Response) return bodyOrErr
      const body = bodyOrErr
      if (!body || (body.id && body.id !== id)) return error('Invalid gathering payload')

      const cardRaw =
        typeof body.menuCardUrl === 'string' ? body.menuCardUrl : existing.menuCardUrl
      const card = sanitizeMenuCardUrl(cardRaw)
      if (typeof card === 'object') return error(card.error, 400)

      // Whitelist only editable event fields (ignore attendees/messages/code from body)
      const next: Gathering = {
        ...existing,
        id,
        title:
          typeof body.title === 'string' ? clip(body.title, MAX_NAME) || existing.title : existing.title,
        type: body.type || existing.type,
        date: typeof body.date === 'string' ? clip(body.date, 32) : existing.date,
        time: typeof body.time === 'string' ? clip(body.time, 16) : existing.time,
        location:
          typeof body.location === 'string' ? clip(body.location, MAX_TEXT) : existing.location,
        notes: typeof body.notes === 'string' ? clip(body.notes, MAX_NOTES) : existing.notes,
        currency:
          typeof body.currency === 'string'
            ? clip(body.currency, 8) || existing.currency
            : existing.currency,
        organizerName:
          typeof body.organizerName === 'string'
            ? clip(body.organizerName, MAX_NAME)
            : existing.organizerName,
        organizerEmail:
          typeof body.organizerEmail === 'string'
            ? clip(body.organizerEmail, MAX_TEXT)
            : existing.organizerEmail,
        organizerPhone:
          typeof body.organizerPhone === 'string'
            ? clip(body.organizerPhone, 40)
            : existing.organizerPhone,
        menuCardUrl: card,
        organizerCode: existing.organizerCode,
        menu: existing.menu,
        carteItems: existing.carteItems,
        carteApproved: existing.carteApproved,
        attendees: existing.attendees,
        messages: existing.messages,
        createdAt: existing.createdAt,
      }
      await writeGathering(env.DB, next, false)
      return json(toClientGathering(next, true))
    }

    if (method === 'DELETE') {
      const existing = await readGathering(env.DB, id)
      if (!existing) return error('Gathering not found', 404)
      const denied = requireOrganizer(request, existing)
      if (denied) return denied
      const result = await env.DB.prepare('DELETE FROM gatherings WHERE id = ?')
        .bind(id)
        .run()
      if (!result.meta.changes) return error('Gathering not found', 404)
      return json({ ok: true })
    }
  }

  const unlockMatch = path.match(/^\/api\/gatherings\/([^/]+)\/unlock$/)
  if (unlockMatch && method === 'POST') {
    const limited = rateLimit(request, 'unlock', 20, 60_000)
    if (limited) return limited
    const id = decodeURIComponent(unlockMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const bodyOrErr = await readJsonBody<{ code?: string }>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const code = normalizeOrganizerCode(bodyOrErr.code || '')
    if (!gathering.organizerCode) {
      // Legacy event: assign a code now so future access is protected
      const assigned = code.length >= 6 ? code : generateOrganizerCode()
      gathering.organizerCode = formatOrganizerCode(assigned)
      await writeGathering(env.DB, gathering, false)
      return json({
        gathering: toClientGathering(gathering, true),
        organizerCode: gathering.organizerCode,
      })
    }
    if (!code || code !== normalizeOrganizerCode(gathering.organizerCode)) {
      return error('Invalid organizer code', 401)
    }
    return json({
      gathering: toClientGathering(gathering, true),
      organizerCode: formatOrganizerCode(gathering.organizerCode),
    })
  }

  const organizerCodeMatch = path.match(
    /^\/api\/gatherings\/([^/]+)\/organizer-code$/,
  )
  if (organizerCodeMatch && method === 'PUT') {
    const id = decodeURIComponent(organizerCodeMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
    const bodyOrErr = await readJsonBody<{ code?: string }>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const nextCode = normalizeOrganizerCode(bodyOrErr.code || '')
    if (nextCode.length < 6 || nextCode.length > 12) {
      return error('Code must be 6–12 letters or numbers')
    }
    const clash = await findGatheringByOrganizerCode(env.DB, nextCode)
    if (clash && clash.id !== id) {
      return error('That code is already used by another event')
    }
    gathering.organizerCode = formatOrganizerCode(nextCode)
    await writeGathering(env.DB, gathering, false)
    return json({
      gathering: toClientGathering(gathering, true),
      organizerCode: gathering.organizerCode,
    })
  }

  const menuCardMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu-card$/)
  if (menuCardMatch && method === 'PUT') {
    const id = decodeURIComponent(menuCardMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
    const bodyOrErr = await readJsonBody<{ menuCardUrl?: string }>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const card = sanitizeMenuCardUrl(bodyOrErr.menuCardUrl || '')
    if (typeof card === 'object') {
      return error(card.error, card.error.includes('large') ? 413 : 400)
    }
    gathering.menuCardUrl = card
    if (!card) {
      gathering.carteItems = []
      gathering.carteApproved = false
    }
    await writeGathering(env.DB, gathering, false)
    return json(toClientGathering(gathering, true))
  }

  const menuCarteMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu-carte$/)
  if (menuCarteMatch && method === 'PUT') {
    const id = decodeURIComponent(menuCarteMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
    const bodyOrErr = await readJsonBody<{
      items?: unknown
      approved?: unknown
    }>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const body = bodyOrErr
    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => {
            const row = item as { id?: string; name?: string }
            const name = clip(row?.name, MAX_NAME)
            if (!name) return null
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
    return json(toClientGathering(gathering, true))
  }

  const menuMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu$/)
  if (menuMatch && method === 'POST') {
    const id = decodeURIComponent(menuMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
    if (gathering.menu.length >= MAX_MENU_ITEMS) {
      return error('Menu item limit reached')
    }
    const bodyOrErr = await readJsonBody<Omit<MenuItem, 'id'>>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const body = bodyOrErr
    if (!body?.name?.trim()) return error('Menu item name is required')
    const isAlaCarte = Boolean(body.isAlaCarte)
    const item: MenuItem = {
      id: newId('menu'),
      name: clip(body.name, MAX_NAME),
      description: clip(body.description, MAX_TEXT),
      price: isAlaCarte ? 0 : Math.max(0, Number(body.price) || 0),
      category: clip(body.category, 60) || 'Mains',
      isAlaCarte,
    }
    gathering.menu.push(item)
    await writeGathering(env.DB, gathering, false)
    return json(toClientGathering(gathering, true), 201)
  }

  const menuItemMatch = path.match(/^\/api\/gatherings\/([^/]+)\/menu\/([^/]+)$/)
  if (menuItemMatch && method === 'DELETE') {
    const id = decodeURIComponent(menuItemMatch[1])
    const itemId = decodeURIComponent(menuItemMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
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
    return json(toClientGathering(gathering, true))
  }

  const attendeesMatch = path.match(/^\/api\/gatherings\/([^/]+)\/attendees$/)
  if (attendeesMatch && method === 'POST') {
    const limited = rateLimit(request, 'rsvp', 40, 60_000)
    if (limited) return limited
    const id = decodeURIComponent(attendeesMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const asOrganizer = isOrganizerAuthorized(request, gathering)
    const bodyOrErr = await readJsonBody<
      Omit<Attendee, 'id' | 'createdAt' | 'amountPaid' | 'guestKey'> & {
        amountPaid?: number
        guestKey?: string
      }
    >(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const body = bodyOrErr
    if (!body?.name?.trim()) return error('Guest name is required')
    const email = normalizeEmail(body.email || '')

    const isGroup = Boolean(body.isGroup)
    const members = isGroup ? normalizeMembers(body.members) : []
    if (isGroup && members.length === 0) {
      return error('Add at least one group member with a menu choice')
    }
    if (!asOrganizer && gathering.attendees.length >= MAX_ATTENDEES) {
      return error('This event is full')
    }

    const existingIdx = email
      ? gathering.attendees.findIndex((a) => normalizeEmail(a.email) === email)
      : -1

    if (existingIdx >= 0) {
      if (asOrganizer) {
        return error('A guest with this email already RSVPed for this event', 409)
      }
      const current = gathering.attendees[existingIdx]
      const providedKey = clip(body.guestKey, 64)
      // Require guestKey when the record already has one (prevents RSVP takeover by email alone)
      if (current.guestKey && providedKey !== current.guestKey) {
        return error(
          'This email already has an RSVP. Update from the same device, or contact the organizer.',
          403,
        )
      }
      const guestKey = current.guestKey || newGuestKey()
      gathering.attendees[existingIdx] = {
        ...current,
        name: clip(body.name, MAX_NAME),
        registeredBy: clip(body.registeredBy || body.name, MAX_NAME),
        email,
        phone: clip(body.phone, 40),
        menuItemIds: isGroup
          ? []
          : Array.isArray(body.menuItemIds)
            ? body.menuItemIds.slice(0, 40)
            : [],
        carteItemIds: isGroup
          ? []
          : Array.isArray(body.carteItemIds)
            ? body.carteItemIds.slice(0, 40)
            : [],
        allergies: isGroup ? '' : clip(body.allergies, MAX_TEXT),
        notes: clip(body.notes, MAX_NOTES),
        menuRequest: isGroup ? '' : clip(body.menuRequest, MAX_NOTES),
        ageGroup: isGroup ? 'adult' : body.ageGroup === 'child' ? 'child' : 'adult',
        amountPaid: current.amountPaid,
        guestKey,
        isGroup,
        members,
        groupSize: isGroup ? Math.max(1, members.length) : 1,
      }
      await writeGathering(env.DB, gathering, false)
      return json({
        gathering: toClientGathering(gathering, false),
        attendeeId: current.id,
        guestKey,
        updated: true,
      })
    }

    const guestKey = newGuestKey()
    const attendee: Attendee = {
      id: newId('guest'),
      name: clip(body.name, MAX_NAME),
      registeredBy: clip(body.registeredBy || body.name, MAX_NAME),
      email: email || clip(body.email, MAX_TEXT),
      phone: clip(body.phone, 40),
      menuItemIds: isGroup
        ? []
        : Array.isArray(body.menuItemIds)
          ? body.menuItemIds.slice(0, 40)
          : [],
      carteItemIds: isGroup
        ? []
        : Array.isArray(body.carteItemIds)
          ? body.carteItemIds.slice(0, 40)
          : [],
      allergies: clip(body.allergies, MAX_TEXT),
      notes: clip(body.notes, MAX_NOTES),
      menuRequest: isGroup ? '' : clip(body.menuRequest, MAX_NOTES),
      ageGroup: isGroup ? 'adult' : body.ageGroup === 'child' ? 'child' : 'adult',
      amountPaid: asOrganizer ? Math.max(0, Number(body.amountPaid) || 0) : 0,
      guestKey,
      createdAt: new Date().toISOString(),
      isGroup,
      members,
      groupSize: isGroup ? Math.max(1, members.length) : 1,
    }
    gathering.attendees.push(attendee)
    await writeGathering(env.DB, gathering, false)
    return json(
      {
        gathering: toClientGathering(gathering, asOrganizer),
        attendeeId: attendee.id,
        guestKey,
        updated: false,
      },
      201,
    )
  }

  const attendeeMatch = path.match(/^\/api\/gatherings\/([^/]+)\/attendees\/([^/]+)$/)
  if (attendeeMatch) {
    const id = decodeURIComponent(attendeeMatch[1])
    const attendeeId = decodeURIComponent(attendeeMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)

    if (method === 'PATCH') {
      const denied = requireOrganizer(request, gathering)
      if (denied) return denied
      const bodyOrErr = await readJsonBody<Partial<Attendee>>(request)
      if (bodyOrErr instanceof Response) return bodyOrErr
      const body = bodyOrErr
      const idx = gathering.attendees.findIndex((a) => a.id === attendeeId)
      if (idx === -1) return error('Attendee not found', 404)
      const current = gathering.attendees[idx]
      const nextEmail =
        body.email !== undefined
          ? normalizeEmail(String(body.email))
          : normalizeEmail(current.email)
      if (nextEmail) {
        const clash = gathering.attendees.find(
          (a, i) => i !== idx && normalizeEmail(a.email) === nextEmail,
        )
        if (clash) {
          return error('A guest with this email already RSVPed for this event', 409)
        }
      }
      const members =
        body.members !== undefined ? normalizeMembers(body.members) : current.members || []
      const isGroup =
        body.isGroup !== undefined ? Boolean(body.isGroup) : current.isGroup
      gathering.attendees[idx] = {
        ...current,
        name: body.name !== undefined ? clip(body.name, MAX_NAME) : current.name,
        registeredBy:
          body.registeredBy !== undefined
            ? clip(body.registeredBy, MAX_NAME)
            : current.registeredBy,
        email:
          body.email !== undefined ? clip(body.email, MAX_TEXT) : current.email,
        phone:
          body.phone !== undefined ? clip(body.phone, 40) : current.phone,
        menuItemIds:
          body.menuItemIds !== undefined
            ? Array.isArray(body.menuItemIds)
              ? body.menuItemIds.slice(0, 40)
              : []
            : current.menuItemIds,
        menuRequest:
          body.menuRequest !== undefined
            ? clip(body.menuRequest, MAX_NOTES)
            : current.menuRequest || '',
        carteItemIds:
          body.carteItemIds !== undefined
            ? Array.isArray(body.carteItemIds)
              ? body.carteItemIds.slice(0, 40)
              : []
            : current.carteItemIds || [],
        allergies:
          body.allergies !== undefined
            ? clip(body.allergies, MAX_TEXT)
            : current.allergies,
        notes: body.notes !== undefined ? clip(body.notes, MAX_NOTES) : current.notes,
        ageGroup:
          body.ageGroup !== undefined
            ? body.ageGroup === 'child'
              ? 'child'
              : 'adult'
            : current.ageGroup || 'adult',
        amountPaid:
          body.amountPaid !== undefined
            ? Math.max(0, Number(body.amountPaid) || 0)
            : current.amountPaid,
        guestKey: current.guestKey || newGuestKey(),
        id: attendeeId,
        isGroup,
        members: isGroup ? members : [],
        groupSize: isGroup
          ? Math.max(1, members.length || Number(body.groupSize) || 1)
          : 1,
        createdAt: current.createdAt,
      }
      await writeGathering(env.DB, gathering, false)
      return json(toClientGathering(gathering, true))
    }

    if (method === 'DELETE') {
      const denied = requireOrganizer(request, gathering)
      if (denied) return denied
      gathering.attendees = gathering.attendees.filter((a) => a.id !== attendeeId)
      await writeGathering(env.DB, gathering, false)
      return json(toClientGathering(gathering, true))
    }
  }

  const messagesMatch = path.match(/^\/api\/gatherings\/([^/]+)\/messages$/)
  if (messagesMatch && method === 'POST') {
    const limited = rateLimit(request, 'message', 15, 60_000)
    if (limited) return limited
    const id = decodeURIComponent(messagesMatch[1])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const bodyOrErr = await readJsonBody<MessageInput>(request)
    if (bodyOrErr instanceof Response) return bodyOrErr
    const body = bodyOrErr
    if (!body?.fromName?.trim()) return error('Your name is required')
    if (!body?.body?.trim()) return error('Message is required')
    const message: InboxMessage = {
      id: newId('msg'),
      fromName: clip(body.fromName, MAX_NAME),
      fromEmail: clip(body.fromEmail, MAX_TEXT),
      fromPhone: clip(body.fromPhone, 40),
      body: clip(body.body, MAX_MESSAGE),
      createdAt: new Date().toISOString(),
      read: false,
    }
    gathering.messages = [message, ...(gathering.messages || [])].slice(0, MAX_MESSAGES)
    await writeGathering(env.DB, gathering, false)
    // Do not return inbox contents to the sender
    return json({ ok: true }, 201)
  }

  const messageMatch = path.match(/^\/api\/gatherings\/([^/]+)\/messages\/([^/]+)$/)
  if (messageMatch) {
    const id = decodeURIComponent(messageMatch[1])
    const messageId = decodeURIComponent(messageMatch[2])
    const gathering = await readGathering(env.DB, id)
    if (!gathering) return error('Gathering not found', 404)
    const denied = requireOrganizer(request, gathering)
    if (denied) return denied
    const idx = (gathering.messages || []).findIndex((m) => m.id === messageId)
    if (idx === -1) return error('Message not found', 404)

    if (method === 'PATCH') {
      const bodyOrErr = await readJsonBody<Partial<InboxMessage>>(request)
      if (bodyOrErr instanceof Response) return bodyOrErr
      const body = bodyOrErr
      gathering.messages[idx] = {
        ...gathering.messages[idx],
        read: body.read !== undefined ? Boolean(body.read) : gathering.messages[idx].read,
      }
      await writeGathering(env.DB, gathering, false)
      return json(toClientGathering(gathering, true))
    }

    if (method === 'DELETE') {
      gathering.messages = gathering.messages.filter((m) => m.id !== messageId)
      await writeGathering(env.DB, gathering, false)
      return json(toClientGathering(gathering, true))
    }
  }

  return error('Not found', 404)
}
