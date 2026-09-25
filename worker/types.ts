export type AgeGroup = 'adult' | 'child'

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  isAlaCarte: boolean
}

export type GroupMember = {
  id: string
  name: string
  menuItemIds: string[]
  allergies: string
  menuRequest: string
  ageGroup: AgeGroup
}

export type Attendee = {
  id: string
  name: string
  registeredBy: string
  email: string
  phone: string
  menuItemIds: string[]
  allergies: string
  notes: string
  menuRequest: string
  ageGroup: AgeGroup
  amountPaid: number
  createdAt: string
  isGroup: boolean
  groupSize: number
  members: GroupMember[]
}

export type InboxMessage = {
  id: string
  fromName: string
  fromEmail: string
  fromPhone: string
  body: string
  createdAt: string
  read: boolean
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
  organizerName: string
  organizerEmail: string
  organizerPhone: string
  menuCardUrl: string
  menuOcrLines: string[]
  menu: MenuItem[]
  attendees: Attendee[]
  messages: InboxMessage[]
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
  organizerName?: string
  organizerEmail?: string
  organizerPhone?: string
  menuCardUrl?: string
}

export type MessageInput = {
  fromName: string
  fromEmail?: string
  fromPhone?: string
  body: string
}

export type Env = {
  DB: D1Database
}
