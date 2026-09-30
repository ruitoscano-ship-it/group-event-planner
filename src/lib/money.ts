import type {
  AgeGroup,
  Attendee,
  CarteItem,
  Gathering,
  GroupMember,
  MenuItem,
} from '../types'

export function formatMoney(
  amount: number,
  currency = 'EUR',
  locale = 'pt-PT',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatDate(date: string, locale = 'pt-PT', dateTbd = 'Date TBD'): string {
  if (!date) return dateTbd
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function createMemberDraft(partial?: Partial<GroupMember>): GroupMember {
  return {
    id: `m_${crypto.randomUUID().replace(/-/g, '')}`,
    name: '',
    menuItemIds: [],
    carteItemIds: [],
    allergies: '',
    menuRequest: '',
    ageGroup: 'adult',
    amountPaid: 0,
    extraAmount: 0,
    ...partial,
  }
}

/** Keep member drafts in sync with a chosen party size (1–30). */
export function resizeMembers(
  current: GroupMember[],
  size: number,
): GroupMember[] {
  const n = Math.max(1, Math.min(30, Math.floor(size) || 1))
  if (current.length === n) return current
  if (current.length > n) return current.slice(0, n)
  return [
    ...current,
    ...Array.from({ length: n - current.length }, () => createMemberDraft()),
  ]
}

export function normalizeAgeGroup(value: unknown): AgeGroup {
  return value === 'child' ? 'child' : 'adult'
}

export function countAgeGroups(attendees: Attendee[]): {
  adults: number
  children: number
} {
  let adults = 0
  let children = 0
  for (const a of attendees) {
    if (a.isGroup && a.members?.length) {
      for (const m of a.members) {
        if (normalizeAgeGroup(m.ageGroup) === 'child') children += 1
        else adults += 1
      }
    } else {
      const size = partySize(a)
      if (normalizeAgeGroup(a.ageGroup) === 'child') children += size
      else adults += size
    }
  }
  return { adults, children }
}

export function partySize(attendee: Attendee): number {
  if (attendee.isGroup) {
    if (attendee.members?.length) return attendee.members.length
    return Math.max(1, attendee.groupSize || 1)
  }
  return 1
}

export function unitPriceForIds(ids: string[], menu: MenuItem[]): number {
  return ids.reduce((sum, id) => {
    const item = menu.find((m) => m.id === id)
    if (!item || item.isAlaCarte) return sum
    return sum + (item.price ?? 0)
  }, 0)
}

/** Fixed-menu owed for one person’s selected menu item ids. */
export function personMenuOwed(ids: string[], menu: MenuItem[]): number {
  return unitPriceForIds(ids, menu)
}

export function personTotal(menuOwed: number, extraAmount = 0): number {
  return Math.max(0, menuOwed) + Math.max(0, extraAmount || 0)
}

export function personRemaining(
  menuOwed: number,
  extraAmount: number,
  amountPaid: number,
): number {
  return Math.max(0, personTotal(menuOwed, extraAmount) - Math.max(0, amountPaid || 0))
}

export function isPersonSettled(
  menuOwed: number,
  extraAmount: number,
  amountPaid: number,
): boolean {
  return personRemaining(menuOwed, extraAmount, amountPaid) <= 0.001
}

/** Legacy group paid on the RSVP parent before per-member billing. */
export function legacyUnallocatedPaid(attendee: Attendee): number {
  if (!attendee.isGroup || !attendee.members?.length) return 0
  const membersPaid = attendee.members.reduce(
    (sum, m) => sum + Math.max(0, m.amountPaid || 0),
    0,
  )
  if (membersPaid > 0) return 0
  return Math.max(0, attendee.amountPaid || 0)
}

export function idsHaveAlaCarte(ids: string[], menu: MenuItem[]): boolean {
  return ids.some((id) => menu.find((m) => m.id === id)?.isAlaCarte)
}

export function selectionHasAlaCarte(attendee: Attendee, menu: MenuItem[]): boolean {
  if (attendee.isGroup && attendee.members?.length) {
    return attendee.members.some((m) => idsHaveAlaCarte(m.menuItemIds, menu))
  }
  return idsHaveAlaCarte(attendee.menuItemIds, menu)
}

export function attendeeUnitPrice(attendee: Attendee, menu: MenuItem[]): number {
  return unitPriceForIds(attendee.menuItemIds, menu)
}

/** Total owed (menu + extras) for an RSVP / party. */
export function attendeeTotal(attendee: Attendee, menu: MenuItem[]): number {
  if (attendee.isGroup && attendee.members?.length) {
    return attendee.members.reduce(
      (sum, m) =>
        sum + personTotal(personMenuOwed(m.menuItemIds, menu), m.extraAmount || 0),
      0,
    )
  }
  // Legacy groups: one shared menu × people
  const menuPart = personMenuOwed(attendee.menuItemIds, menu) * partySize(attendee)
  return personTotal(menuPart, attendee.extraAmount || 0)
}

export function attendeePaidTotal(attendee: Attendee): number {
  if (attendee.isGroup && attendee.members?.length) {
    const memberPaid = attendee.members.reduce(
      (sum, m) => sum + Math.max(0, m.amountPaid || 0),
      0,
    )
    return memberPaid + legacyUnallocatedPaid(attendee)
  }
  return Math.max(0, attendee.amountPaid || 0)
}

export function attendeeRemaining(attendee: Attendee, menu: MenuItem[]): number {
  return Math.max(0, attendeeTotal(attendee, menu) - attendeePaidTotal(attendee))
}

export function attendeeSettled(attendee: Attendee, menu: MenuItem[]): boolean {
  return attendeeRemaining(attendee, menu) <= 0.001
}

export function gatheringTotals(gathering: Gathering) {
  const owed = gathering.attendees.reduce(
    (sum, a) => sum + attendeeTotal(a, gathering.menu),
    0,
  )
  const paid = gathering.attendees.reduce((sum, a) => sum + attendeePaidTotal(a), 0)
  const outstanding = Math.max(0, owed - paid)
  const guestCount = gathering.attendees.reduce((sum, a) => sum + partySize(a), 0)
  const inviteCount = gathering.attendees.length
  const { adults, children } = countAgeGroups(gathering.attendees)
  const hasVariable = gathering.attendees.some((a) =>
    selectionHasAlaCarte(a, gathering.menu),
  )
  return { owed, paid, outstanding, guestCount, inviteCount, adults, children, hasVariable }
}

export function menuLabel(
  ids: string[],
  menu: MenuItem[],
  noSelection = 'No selection',
): string {
  if (ids.length === 0) return noSelection
  return ids
    .map((id) => menu.find((m) => m.id === id)?.name ?? 'Unknown')
    .join(', ')
}

export function carteLabel(
  ids: string[],
  carte: CarteItem[],
  noSelection = '',
): string {
  if (!ids.length) return noSelection
  return ids
    .map((id) => carte.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

export function toggleCarteSelection(currentIds: string[], itemId: string): string[] {
  return currentIds.includes(itemId)
    ? currentIds.filter((id) => id !== itemId)
    : [...currentIds, itemId]
}

/** Combined display of fixed menu + carte picks + free-text extras. */
export function personOrderLabel(
  menuItemIds: string[],
  carteItemIds: string[],
  menuRequest: string,
  gathering: Gathering,
  noSelection = 'No selection',
): string {
  const parts = [
    menuLabel(menuItemIds, gathering.menu, ''),
    carteLabel(carteItemIds, gathering.carteItems || [], ''),
    (menuRequest || '').trim(),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : noSelection
}

/** Toggle menu selection with exclusivity between fixed menus and à la carte. */
export function toggleMenuSelection(
  currentIds: string[],
  itemId: string,
  menu: MenuItem[],
): string[] {
  const item = menu.find((m) => m.id === itemId)
  if (!item) return currentIds
  const selected = currentIds.includes(itemId)
  if (selected) return currentIds.filter((x) => x !== itemId)
  if (item.isAlaCarte) return [itemId]
  const withoutAla = currentIds.filter(
    (x) => !menu.find((m) => m.id === x)?.isAlaCarte,
  )
  return [...withoutAla, itemId]
}

/** Compress an image file to a JPEG data URL suitable for D1 storage. */
export function compressImageFile(file: File, maxWidth = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxWidth / img.width)
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not process image'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length > 700_000) {
        reject(new Error('Image is still too large after compression'))
        return
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image'))
    }
    img.src = objectUrl
  })
}
