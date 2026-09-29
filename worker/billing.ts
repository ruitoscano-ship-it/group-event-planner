/** Preserve organizer-set billing fields when guests update their RSVP. */

export type BillingMember = {
  id: string
  amountPaid?: number
  extraAmount?: number
}

export function preserveMemberBilling<T extends BillingMember>(
  next: T[],
  previous: T[] | undefined,
): T[] {
  if (!previous?.length) return next
  const byId = new Map(previous.map((m) => [m.id, m]))
  return next.map((m) => {
    const prev = byId.get(m.id)
    if (!prev) return m
    return {
      ...m,
      amountPaid: Math.max(0, Number(prev.amountPaid) || 0),
      extraAmount: Math.max(0, Number(prev.extraAmount) || 0),
    }
  })
}
