export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  /** When true, price is variable / TBD — not used for billing totals. */
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
  /** Family / group registration */
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
  /** Uploaded image path or external URL to the printed menu / carte */
  menuCardUrl: string
  menu: MenuItem[]
  attendees: Attendee[]
  createdAt: string
}

export type GatheringInput = Omit<
  Gathering,
  'id' | 'menu' | 'attendees' | 'createdAt' | 'menuCardUrl'
> & {
  menuCardUrl?: string
}
