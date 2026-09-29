/** Day-of WhatsApp blurbs: allergy digest + restaurant booking ping. */

import { countAgeGroups } from './money'
import { flattenInvitees, type ReportPerson } from './report'
import type { Gathering } from '../types'

function allergyPeople(gathering: Gathering): ReportPerson[] {
  return flattenInvitees(gathering).filter((p) => (p.allergies || '').trim())
}

export function buildAllergyDigestText(
  gathering: Gathering,
  locale: 'pt' | 'en',
): string {
  const rows = allergyPeople(gathering)
  if (locale === 'pt') {
    if (!rows.length) {
      return [
        `Alergias — ${gathering.title}`,
        'Nenhuma alergia / necessidade alimentar registada.',
      ].join('\n')
    }
    return [
      `Alergias — ${gathering.title}`,
      ...rows.map((p) => {
        const dish = [p.menu !== '—' ? p.menu : '', p.carte !== '—' ? p.carte : '']
          .filter(Boolean)
          .join(' · ')
        return `• ${p.name}: ${p.allergies.trim()}${dish ? ` (${dish})` : ''}`
      }),
    ].join('\n')
  }
  if (!rows.length) {
    return [
      `Allergies — ${gathering.title}`,
      'No allergies / dietary needs recorded.',
    ].join('\n')
  }
  return [
    `Allergies — ${gathering.title}`,
    ...rows.map((p) => {
      const dish = [p.menu !== '—' ? p.menu : '', p.carte !== '—' ? p.carte : '']
        .filter(Boolean)
        .join(' · ')
      return `• ${p.name}: ${p.allergies.trim()}${dish ? ` (${dish})` : ''}`
    }),
  ].join('\n')
}

export function buildBookingPingText(
  gathering: Gathering,
  input: { dateLabel: string; locale: 'pt' | 'en' },
): string {
  const { adults, children } = countAgeGroups(gathering.attendees)
  const total = adults + children
  const allergies = allergyPeople(gathering)
  const when = [input.dateLabel, gathering.time].filter(Boolean).join(' · ')
  const where = (gathering.location || '').trim()

  if (input.locale === 'pt') {
    const lines = [
      `Reserva — ${gathering.title}`,
      when ? `Quando: ${when}` : '',
      where ? `Onde: ${where}` : '',
      `Pessoas: ${total} (${adults} adultos${children ? `, ${children} crianças` : ''})`,
    ]
    if (allergies.length) {
      lines.push('Alergias:')
      for (const p of allergies) {
        lines.push(`• ${p.name}: ${p.allergies.trim()}`)
      }
    } else {
      lines.push('Alergias: nenhuma registada')
    }
    return lines.filter(Boolean).join('\n')
  }

  const lines = [
    `Booking — ${gathering.title}`,
    when ? `When: ${when}` : '',
    where ? `Where: ${where}` : '',
    `People: ${total} (${adults} adults${children ? `, ${children} children` : ''})`,
  ]
  if (allergies.length) {
    lines.push('Allergies:')
    for (const p of allergies) {
      lines.push(`• ${p.name}: ${p.allergies.trim()}`)
    }
  } else {
    lines.push('Allergies: none recorded')
  }
  return lines.filter(Boolean).join('\n')
}
