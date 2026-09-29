import { describe, expect, it } from 'vitest'
import { hasPaymentInstructions } from './paymentInfo'
import { isRsvpOpen, todayLocalIsoDate } from './rsvpStatus'
import { buildInviteShareText, whatsappShareUrl } from './inviteShare'
import { buildGatheringIcs, toIcsLocalStamp } from './calendarIcs'
import {
  mailtoNudgeUrl,
  unpaidNudgeText,
  whatsappNudgeUrl,
} from './nudgeLinks'

describe('payment instructions', () => {
  it('detects any filled payment field', () => {
    expect(
      hasPaymentInstructions({
        paymentIban: '',
        paymentMbWay: '',
        paymentBizum: '',
        paymentNote: '',
        paymentQrUrl: '',
      }),
    ).toBe(false)
    expect(
      hasPaymentInstructions({
        paymentIban: 'PT5000',
        paymentMbWay: '',
        paymentBizum: '',
        paymentNote: '',
        paymentQrUrl: '',
      }),
    ).toBe(true)
  })
})

describe('rsvp open/closed', () => {
  it('respects manual close, deadline, and archive', () => {
    expect(
      isRsvpOpen({ rsvpClosed: false, rsvpDeadline: '', archivedAt: null }),
    ).toBe(true)
    expect(
      isRsvpOpen({ rsvpClosed: true, rsvpDeadline: '', archivedAt: null }),
    ).toBe(false)
    expect(
      isRsvpOpen({
        rsvpClosed: false,
        rsvpDeadline: '2000-01-01',
        archivedAt: null,
      }),
    ).toBe(false)
    expect(
      isRsvpOpen({
        rsvpClosed: false,
        rsvpDeadline: '2099-12-31',
        archivedAt: null,
      }),
    ).toBe(true)
    expect(
      isRsvpOpen({
        rsvpClosed: false,
        rsvpDeadline: '',
        archivedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false)
    expect(todayLocalIsoDate(new Date('2026-09-29T12:00:00'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
  })
})

describe('invite share', () => {
  it('builds PT/EN invite text and WhatsApp URL', () => {
    const pt = buildInviteShareText({
      title: 'Almoço',
      dateLabel: 'sex., 10 abr. 2026',
      time: '13:00',
      location: 'Lisboa',
      rsvpUrl: 'https://example.com/rsvp/1',
      locale: 'pt',
    })
    expect(pt).toContain('Convite: Almoço')
    expect(pt).toContain('https://example.com/rsvp/1')
    expect(whatsappShareUrl('olá')).toContain('wa.me')
  })
})

describe('calendar ics', () => {
  it('builds a VEVENT for dated gatherings', () => {
    expect(toIcsLocalStamp('2026-04-10', '13:30')).toBe('20260410T133000')
    const ics = buildGatheringIcs({
      id: 'evt_1',
      title: 'Lunch',
      date: '2026-04-10',
      time: '13:00',
      location: 'Lisbon',
      notes: 'Bring cash',
      rsvpUrl: 'https://example.com/rsvp/1',
    })
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Lunch')
    expect(ics).toContain('DTSTART:20260410T130000')
  })
})

describe('nudge links', () => {
  it('builds WhatsApp and mailto links for outstanding guests', () => {
    const text = unpaidNudgeText({
      guestName: 'Alex',
      eventTitle: 'Friday',
      amountLabel: '€10.00',
      locale: 'en',
    })
    expect(text).toContain('Alex')
    expect(whatsappNudgeUrl('+351 912 345 678', text)).toContain('wa.me/351912345678')
    expect(mailtoNudgeUrl('a@b.com', 'Pay', text)).toContain('mailto:')
    expect(whatsappNudgeUrl('', text)).toBeNull()
  })
})
