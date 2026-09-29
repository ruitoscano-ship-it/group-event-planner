import { describe, expect, it } from 'vitest'
import {
  attendeePaidTotal,
  attendeeRemaining,
  attendeeSettled,
  attendeeTotal,
  gatheringTotals,
  isPersonSettled,
  legacyUnallocatedPaid,
  personMenuOwed,
  personRemaining,
  personTotal,
  resizeMembers,
  toggleMenuSelection,
} from './money'
import {
  alaCarte,
  makeGathering,
  makeGroup,
  makeMember,
  makeSolo,
  sampleMenu,
  setMenuAdult,
  setMenuChild,
} from './testFixtures'

describe('per-person billing', () => {
  it('owes set-menu price plus extras', () => {
    expect(personMenuOwed([setMenuAdult.id], sampleMenu)).toBe(25)
    expect(personTotal(25, 3.5)).toBe(28.5)
    expect(personRemaining(25, 3.5, 10)).toBe(18.5)
    expect(isPersonSettled(25, 0, 25)).toBe(true)
    expect(isPersonSettled(25, 0, 24.99)).toBe(false)
  })

  it('ignores à la carte prices in owed totals', () => {
    expect(personMenuOwed([alaCarte.id], sampleMenu)).toBe(0)
    expect(personTotal(0, 8)).toBe(8)
  })
})

describe('solo RSVP settlement', () => {
  it('tracks menu + extra − paid', () => {
    const solo = makeSolo({
      menuItemIds: [setMenuAdult.id],
      extraAmount: 5,
      amountPaid: 10,
    })
    expect(attendeeTotal(solo, sampleMenu)).toBe(30)
    expect(attendeePaidTotal(solo)).toBe(10)
    expect(attendeeRemaining(solo, sampleMenu)).toBe(20)
    expect(attendeeSettled(solo, sampleMenu)).toBe(false)
  })

  it('marks settled when paid covers total', () => {
    const solo = makeSolo({
      menuItemIds: [setMenuAdult.id],
      amountPaid: 25,
    })
    expect(attendeeSettled(solo, sampleMenu)).toBe(true)
  })
})

describe('group RSVP settlement', () => {
  it('sums each member menu + extras', () => {
    const group = makeGroup({
      members: [
        makeMember({
          id: 'm1',
          menuItemIds: [setMenuAdult.id],
          extraAmount: 2,
          amountPaid: 10,
        }),
        makeMember({
          id: 'm2',
          menuItemIds: [setMenuChild.id],
          ageGroup: 'child',
          extraAmount: 0,
          amountPaid: 12,
        }),
      ],
    })
    // 25+2 + 12 = 39 owed; 10+12 = 22 paid
    expect(attendeeTotal(group, sampleMenu)).toBe(39)
    expect(attendeePaidTotal(group)).toBe(22)
    expect(attendeeRemaining(group, sampleMenu)).toBe(17)
  })

  it('uses legacy parent amountPaid only when members have no payments', () => {
    const group = makeGroup({
      amountPaid: 40,
      members: [
        makeMember({ id: 'm1', menuItemIds: [setMenuAdult.id], amountPaid: 0 }),
        makeMember({ id: 'm2', menuItemIds: [setMenuChild.id], amountPaid: 0 }),
      ],
    })
    expect(legacyUnallocatedPaid(group)).toBe(40)
    expect(attendeePaidTotal(group)).toBe(40)

    const migrated = makeGroup({
      amountPaid: 40,
      members: [
        makeMember({ id: 'm1', menuItemIds: [setMenuAdult.id], amountPaid: 5 }),
        makeMember({ id: 'm2', menuItemIds: [setMenuChild.id], amountPaid: 0 }),
      ],
    })
    expect(legacyUnallocatedPaid(migrated)).toBe(0)
    expect(attendeePaidTotal(migrated)).toBe(5)
  })
})

describe('gathering totals', () => {
  it('rolls up guests, ages, owed, and outstanding', () => {
    const gathering = makeGathering({
      attendees: [
        makeSolo({ amountPaid: 25 }),
        makeGroup({
          members: [
            makeMember({
              id: 'm1',
              menuItemIds: [setMenuAdult.id],
              amountPaid: 0,
            }),
            makeMember({
              id: 'm2',
              menuItemIds: [setMenuChild.id],
              ageGroup: 'child',
              amountPaid: 0,
            }),
          ],
        }),
      ],
    })
    const totals = gatheringTotals(gathering)
    expect(totals.guestCount).toBe(3)
    expect(totals.inviteCount).toBe(2)
    expect(totals.adults).toBe(2)
    expect(totals.children).toBe(1)
    expect(totals.owed).toBe(25 + 25 + 12)
    expect(totals.paid).toBe(25)
    expect(totals.outstanding).toBe(37)
    expect(totals.hasVariable).toBe(false)
  })

  it('flags à la carte selections as variable', () => {
    const gathering = makeGathering({
      attendees: [makeSolo({ menuItemIds: [alaCarte.id] })],
    })
    expect(gatheringTotals(gathering).hasVariable).toBe(true)
  })
})

describe('menu selection exclusivity', () => {
  it('allows stacking fixed menus', () => {
    expect(
      toggleMenuSelection([setMenuAdult.id], setMenuChild.id, sampleMenu),
    ).toEqual([setMenuAdult.id, setMenuChild.id])
  })

  it('replaces everything when picking à la carte', () => {
    expect(
      toggleMenuSelection(
        [setMenuAdult.id, setMenuChild.id],
        alaCarte.id,
        sampleMenu,
      ),
    ).toEqual([alaCarte.id])
  })

  it('clears à la carte when picking a fixed menu', () => {
    expect(
      toggleMenuSelection([alaCarte.id], setMenuAdult.id, sampleMenu),
    ).toEqual([setMenuAdult.id])
  })

  it('toggles off a selected item', () => {
    expect(
      toggleMenuSelection([setMenuAdult.id], setMenuAdult.id, sampleMenu),
    ).toEqual([])
  })
})

describe('party size drafts', () => {
  it('grows and shrinks member drafts between 1 and 30', () => {
    const one = resizeMembers([], 1)
    expect(one).toHaveLength(1)
    const three = resizeMembers(one, 3)
    expect(three).toHaveLength(3)
    expect(three[0].id).toBe(one[0].id)
    expect(resizeMembers(three, 2)).toHaveLength(2)
    expect(resizeMembers(three, 0)).toHaveLength(1)
    expect(resizeMembers(three, 100)).toHaveLength(30)
  })
})
