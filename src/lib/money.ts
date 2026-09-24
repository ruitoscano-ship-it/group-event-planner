import type { Attendee, Gathering, MenuItem } from '../types'

export function formatMoney(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatDate(date: string): string {
  if (!date) return 'Date TBD'
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function attendeeTotal(attendee: Attendee, menu: MenuItem[]): number {
  return attendee.menuItemIds.reduce((sum, id) => {
    const item = menu.find((m) => m.id === id)
    return sum + (item?.price ?? 0)
  }, 0)
}

export function gatheringTotals(gathering: Gathering) {
  const owed = gathering.attendees.reduce(
    (sum, a) => sum + attendeeTotal(a, gathering.menu),
    0,
  )
  const paid = gathering.attendees.reduce((sum, a) => sum + a.amountPaid, 0)
  const outstanding = Math.max(0, owed - paid)
  return { owed, paid, outstanding, guestCount: gathering.attendees.length }
}

export function menuLabel(ids: string[], menu: MenuItem[]): string {
  if (ids.length === 0) return 'No selection'
  return ids
    .map((id) => menu.find((m) => m.id === id)?.name ?? 'Unknown')
    .join(', ')
}
