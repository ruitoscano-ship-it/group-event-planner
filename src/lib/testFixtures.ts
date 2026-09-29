import type { Attendee, Gathering, GroupMember, MenuItem } from '../types'
import { createMemberDraft } from './money'

export const setMenuAdult: MenuItem = {
  id: 'menu_adult',
  name: 'Menu Adult',
  description: '',
  price: 25,
  category: 'Set menu',
  isAlaCarte: false,
}

export const setMenuChild: MenuItem = {
  id: 'menu_child',
  name: 'Menu Child',
  description: '',
  price: 12,
  category: 'Set menu',
  isAlaCarte: false,
}

export const alaCarte: MenuItem = {
  id: 'menu_carte',
  name: 'À la carte',
  description: '',
  price: 0,
  category: 'Carte',
  isAlaCarte: true,
}

export const sampleMenu: MenuItem[] = [setMenuAdult, setMenuChild, alaCarte]

export function makeMember(partial?: Partial<GroupMember>): GroupMember {
  return createMemberDraft(partial)
}

export function makeSolo(partial?: Partial<Attendee>): Attendee {
  return {
    id: 'a_solo',
    name: 'Alex',
    registeredBy: 'Alex',
    email: 'alex@example.com',
    phone: '',
    menuItemIds: [setMenuAdult.id],
    carteItemIds: [],
    allergies: '',
    notes: '',
    menuRequest: '',
    ageGroup: 'adult',
    amountPaid: 0,
    extraAmount: 0,
    createdAt: '2026-01-01T12:00:00.000Z',
    isGroup: false,
    groupSize: 1,
    members: [],
    ...partial,
  }
}

export function makeGroup(partial?: Partial<Attendee>): Attendee {
  const members = partial?.members ?? [
    makeMember({
      id: 'm1',
      name: 'Pat',
      menuItemIds: [setMenuAdult.id],
      amountPaid: 0,
      extraAmount: 0,
    }),
    makeMember({
      id: 'm2',
      name: 'Sam',
      menuItemIds: [setMenuChild.id],
      ageGroup: 'child',
      amountPaid: 0,
      extraAmount: 0,
    }),
  ]
  return {
    id: 'a_group',
    name: 'Pat’s party',
    registeredBy: 'Pat',
    email: 'pat@example.com',
    phone: '',
    menuItemIds: [],
    carteItemIds: [],
    allergies: '',
    notes: '',
    menuRequest: '',
    ageGroup: 'adult',
    amountPaid: 0,
    extraAmount: 0,
    createdAt: '2026-01-01T12:00:00.000Z',
    isGroup: true,
    groupSize: members.length,
    members,
    ...partial,
    members,
  }
}

export function makeGathering(partial?: Partial<Gathering>): Gathering {
  return {
    id: 'evt_test',
    title: 'Friday lunch',
    type: 'lunch',
    date: '2026-04-10',
    time: '13:00',
    location: 'Lisbon',
    notes: '',
    currency: 'EUR',
    organizerName: 'Org',
    organizerEmail: 'org@example.com',
    organizerPhone: '',
    menuCardUrl: '',
    carteItems: [],
    carteApproved: false,
    menu: sampleMenu,
    attendees: [],
    messages: [],
    createdAt: '2026-01-01T12:00:00.000Z',
    ...partial,
  }
}
