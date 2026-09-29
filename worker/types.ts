export type AgeGroup = 'adult' | 'child'

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  isAlaCarte: boolean
  exclusions?: string
}

export type CarteItem = {
  id: string
  name: string
}

export type GroupMember = {
  id: string
  name: string
  menuItemIds: string[]
  carteItemIds: string[]
  allergies: string
  menuRequest: string
  ageGroup: AgeGroup
  extraAmount: number
  amountPaid: number
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
  extraAmount: number
  /** Guest attested they sent payment; ISO or empty. */
  paymentClaimedAt: string
  createdAt: string
  isGroup: boolean
  groupSize: number
  members: GroupMember[]
  /** Secret proof to update this RSVP; never exposed on public GETs. */
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
  /** Secret code that unlocks organizer manage access. Never sent on public GETs. */
  organizerCode: string
  /** Google-linked owner; optional for legacy / code-only events. */
  ownerUserId?: string | null
  menuCardUrl: string
  paymentIban: string
  paymentMbWay: string
  paymentBizum: string
  paymentNote: string
  paymentQrUrl: string
  rsvpDeadline: string
  rsvpClosed: boolean
  carteItems: CarteItem[]
  carteApproved: boolean
  menu: MenuItem[]
  attendees: Attendee[]
  messages: InboxMessage[]
  createdAt: string
  /** ISO timestamp when admin archived the event; null/undefined = active */
  archivedAt?: string | null
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
  /** Set via `wrangler secret put ADMIN_PASSWORD` (min 8 chars). */
  ADMIN_PASSWORD?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** HMAC secret for organizer session cookies (min 16 chars). */
  ORGANIZER_SESSION_SECRET?: string
}
