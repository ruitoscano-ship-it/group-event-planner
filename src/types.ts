export type AgeGroup = 'adult' | 'child'

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  /** When true, price is variable / TBD — not used for billing totals. */
  isAlaCarte: boolean
}

export type GroupMember = {
  id: string
  name: string
  menuItemIds: string[]
  allergies: string
  /** Free-text order from a printed menu / carte */
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
  /** Free-text order from a printed menu / carte */
  menuRequest: string
  ageGroup: AgeGroup
  amountPaid: number
  createdAt: string
  /** Family / group registration */
  isGroup: boolean
  groupSize: number
  /** Per-person menu picks when registering as a group */
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
  /** Uploaded image path or external URL to the printed menu / carte */
  menuCardUrl: string
  /** Dish lines extracted from the menu card via OCR */
  menuOcrLines: string[]
  menu: MenuItem[]
  attendees: Attendee[]
  messages: InboxMessage[]
  createdAt: string
}

export type GatheringInput = Omit<
  Gathering,
  'id' | 'menu' | 'attendees' | 'messages' | 'createdAt' | 'menuCardUrl' | 'menuOcrLines'
> & {
  menuCardUrl?: string
  menuOcrLines?: string[]
}

export type MessageInput = {
  fromName: string
  fromEmail?: string
  fromPhone?: string
  body: string
}
