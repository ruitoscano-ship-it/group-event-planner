import { describe, expect, it } from 'vitest'
import { preserveMemberBilling } from './billing'

describe('preserveMemberBilling', () => {
  it('keeps organizer billing when guests update member details', () => {
    const previous = [
      { id: 'm1', name: 'Pat', amountPaid: 20, extraAmount: 3 },
      { id: 'm2', name: 'Sam', amountPaid: 12, extraAmount: 0 },
    ]
    const next = [
      { id: 'm1', name: 'Patricia', amountPaid: 0, extraAmount: 99 },
      { id: 'm2', name: 'Samantha', amountPaid: 999, extraAmount: 1 },
    ]
    expect(preserveMemberBilling(next, previous)).toEqual([
      { id: 'm1', name: 'Patricia', amountPaid: 20, extraAmount: 3 },
      { id: 'm2', name: 'Samantha', amountPaid: 12, extraAmount: 0 },
    ])
  })

  it('zeros billing for new members and empty previous', () => {
    const next = [{ id: 'm3', name: 'New', amountPaid: 40, extraAmount: 5 }]
    expect(preserveMemberBilling(next, undefined)).toEqual([
      { id: 'm3', name: 'New', amountPaid: 0, extraAmount: 0 },
    ])
    expect(
      preserveMemberBilling(next, [
        { id: 'm1', name: 'Old', amountPaid: 10, extraAmount: 0 },
      ]),
    ).toEqual([{ id: 'm3', name: 'New', amountPaid: 0, extraAmount: 0 }])
  })

  it('clamps negative billing to zero', () => {
    const previous = [{ id: 'm1', amountPaid: -5, extraAmount: -2 }]
    const next = [{ id: 'm1', amountPaid: 1, extraAmount: 1 }]
    expect(preserveMemberBilling(next, previous)).toEqual([
      { id: 'm1', amountPaid: 0, extraAmount: 0 },
    ])
  })
})
