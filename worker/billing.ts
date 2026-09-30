/** Preserve organizer-set billing fields when guests update their RSVP. */

export type BillingMember = {
  id: string
  amountPaid?: number
  extraAmount?: number
}

/**
 * Guests must never set billing. Existing members keep organizer values;
 * new / unknown member ids get zeroed extras and paid.
 */
export function preserveMemberBilling<T extends BillingMember>(
  next: T[],
  previous: T[] | undefined,
): T[] {
  const byId = new Map((previous || []).map((m) => [m.id, m]))
  return next.map((m) => {
    const prev = byId.get(m.id)
    if (!prev) {
      return {
        ...m,
        amountPaid: 0,
        extraAmount: 0,
      }
    }
    return {
      ...m,
      amountPaid: Math.max(0, Number(prev.amountPaid) || 0),
      extraAmount: Math.max(0, Number(prev.extraAmount) || 0),
    }
  })
}
