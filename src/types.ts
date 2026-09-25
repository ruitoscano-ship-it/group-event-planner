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

/** Dish on the event carte (from OCR or manually added by organizer). */
export type CarteItem = {
  id: string
  name: string
}

export type GroupMember = {
  id: string
  name: string
  menuItemIds: string[]
  /** Multi-pick from the approved event carte */
  carteItemIds: string[]
  allergies: string
  /** Free-text extras beyond carte / fixed menu */
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
  carteItemIds: string[]
  allergies: string
  notes: string
  menuRequest: string
  ageGroup: AgeGroup
  amountPaid: number
  createdAt: string
  isGroup: boolean
  groupSize: number
  members: GroupMember[]
  /** Opaque key required to update this RSVP; only returned on create/update. */
  guestKey?: string
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
  /** Editable event carte (organizer-managed, often from OCR) */
  carteItems: CarteItem[]
  /** When true, invitees can multi-pick from the carte */
  carteApproved: boolean
  menu: MenuItem[]
  attendees: Attendee[]
  messages: InboxMessage[]
  createdAt: string
}

/** Returned only from create / unlock — includes the manage code. */
export type GatheringAccess = {
  gathering: Gathering
  organizerCode: string
}

export type GatheringInput = Omit<
  Gathering,
  | 'id'
  | 'menu'
  | 'attendees'
  | 'messages'
  | 'createdAt'
  | 'menuCardUrl'
  | 'carteItems'
  | 'carteApproved'
> & {
  menuCardUrl?: string
  carteItems?: CarteItem[]
  carteApproved?: boolean
}

export type MessageInput = {
  fromName: string
  fromEmail?: string
  fromPhone?: string
  body: string
}
