import { describe, expect, it } from 'vitest'
import { flattenInvitees, tallyMenuTypes } from './report'
import {
  alaCarte,
  makeGathering,
  makeGroup,
  makeMember,
  makeSolo,
  setMenuAdult,
  setMenuChild,
} from './testFixtures'

describe('tallyMenuTypes', () => {
  it('counts set menus by category and carte picks separately', () => {
    const gathering = makeGathering({
      carteItems: [{ id: 'c1', name: 'Soup' }],
      attendees: [
        makeSolo({ menuItemIds: [setMenuAdult.id], carteItemIds: ['c1'] }),
        makeGroup({
          members: [
            makeMember({ id: 'm1', menuItemIds: [setMenuAdult.id] }),
            makeMember({
              id: 'm2',
              menuItemIds: [alaCarte.id],
              carteItemIds: ['c1'],
            }),
          ],
        }),
      ],
    })
    const tallies = tallyMenuTypes(gathering, 'Carte')
    const set = tallies.find((t) => t.label === 'Set menu')
    const carte = tallies.find((t) => t.key === 'carte')
    const variable = tallies.find((t) => t.hasVariable && t.label === 'Carte')
    expect(set?.count).toBe(2)
    expect(set?.cost).toBe(50)
    expect(carte?.count).toBe(2)
    expect(variable?.hasVariable).toBe(true)
  })
})

describe('flattenInvitees', () => {
  it('expands group members into report rows', () => {
    const gathering = makeGathering({
      attendees: [
        makeSolo({ name: 'Alex' }),
        makeGroup({
          name: 'Party',
          members: [
            makeMember({
              id: 'm1',
              name: 'Pat',
              menuItemIds: [setMenuAdult.id],
            }),
            makeMember({
              id: 'm2',
              name: 'Sam',
              menuItemIds: [setMenuChild.id],
              ageGroup: 'child',
            }),
          ],
        }),
      ],
    })
    const people = flattenInvitees(gathering)
    expect(people.map((p) => p.name)).toEqual(['Alex', 'Pat', 'Sam'])
    expect(people[1].party).toBe('Party')
    expect(people[2].ageGroup).toBe('child')
  })
})
