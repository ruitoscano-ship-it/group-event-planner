import type { Attendee, Gathering, GroupMember, MenuItem } from '../types'

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
    id: `m_${crypto.randomUUID().slice(0, 8)}`,
    name: '',
    menuItemIds: [],
    allergies: '',
    ...partial,
  }
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

export function attendeeTotal(attendee: Attendee, menu: MenuItem[]): number {
  if (attendee.isGroup && attendee.members?.length) {
    return attendee.members.reduce(
      (sum, m) => sum + unitPriceForIds(m.menuItemIds, menu),
      0,
    )
  }
  // Legacy groups: one shared menu × people
  return unitPriceForIds(attendee.menuItemIds, menu) * partySize(attendee)
}

export function gatheringTotals(gathering: Gathering) {
  const owed = gathering.attendees.reduce(
    (sum, a) => sum + attendeeTotal(a, gathering.menu),
    0,
  )
  const paid = gathering.attendees.reduce((sum, a) => sum + a.amountPaid, 0)
  const outstanding = Math.max(0, owed - paid)
  const guestCount = gathering.attendees.reduce((sum, a) => sum + partySize(a), 0)
  const hasVariable = gathering.attendees.some((a) =>
    selectionHasAlaCarte(a, gathering.menu),
  )
  return { owed, paid, outstanding, guestCount, hasVariable }
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
