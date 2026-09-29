/** Build a minimal .ics calendar event for a gathering. */

function icsEscape(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local floating datetime YYYYMMDDTHHMMSS from date + HH:MM. */
export function toIcsLocalStamp(date: string, time: string): string | null {
  const d = (date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const t = (time || '').trim()
  const hm = /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5) : '12:00'
  const [hh, mm] = hm.split(':')
  const [y, mo, day] = d.split('-')
  return `${y}${mo}${day}T${pad(Number(hh))}${pad(Number(mm))}00`
}

export function buildGatheringIcs(input: {
  id: string
  title: string
  date: string
  time: string
  location: string
  notes: string
  rsvpUrl: string
}): string | null {
  const start = toIcsLocalStamp(input.date, input.time)
  if (!start) return null
  const endHour = (() => {
    const t = (input.time || '').trim()
    const hm = /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5) : '12:00'
    const [hh, mm] = hm.split(':').map(Number)
    const endH = (hh + 2) % 24
    return `${start.slice(0, 8)}T${pad(endH)}${pad(mm)}00`
  })()
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const description = [input.notes, input.rsvpUrl].filter(Boolean).join('\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Round//Friends Lunch Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsEscape(input.id)}@round.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${endHour}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `LOCATION:${icsEscape(input.location)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${icsEscape(input.rsvpUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadIcs(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
