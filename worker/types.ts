export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  isAlaCarte: boolean
}

export type Attendee = {
  id: string
  name: string
  registeredBy: string
  menuItemIds: string[]
  allergies: string
  notes: string
  amountPaid: number
  createdAt: string
  isGroup: boolean
  groupSize: number
}

export type Gathering = {
  id: string
  title: string
  type: 'lunch' | 'dinner' | 'brunch' | 'other'
  date: string
  time: string
  location: string
  notes: string
  currency: string
  menuCardUrl: string
  menu: MenuItem[]
  attendees: Attendee[]
  createdAt: string
}

export type GatheringInput = {
  title: string
  type: Gathering['type']
  date: string
  time: string
  location: string
  notes: string
  currency: string
  menuCardUrl?: string
}

export type Env = {
  DB: D1Database
}
