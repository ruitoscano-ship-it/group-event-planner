import type { Attendee, Gathering, GroupMember } from '../types'
import {
  formatDate,
  formatMoney,
  gatheringTotals,
  normalizeAgeGroup,
  personOrderLabel,
} from './money'

export type ReportPerson = {
  id: string
  name: string
  ageGroup: 'adult' | 'child'
  party: string
  menu: string
  menuRequest: string
  allergies: string
  email: string
  phone: string
  notes: string
}

function personFromSolo(a: Attendee, gathering: Gathering): ReportPerson {
  const cartePart = personOrderLabel(
    [],
    a.carteItemIds || [],
    a.menuRequest || '',
    gathering,
    '',
  )
  return {
    id: a.id,
    name: a.name,
    ageGroup: normalizeAgeGroup(a.ageGroup),
    party: a.name,
    menu: personOrderLabel(a.menuItemIds, [], '', gathering, '—'),
    menuRequest: cartePart || '—',
    allergies: (a.allergies || '').trim(),
    email: (a.email || '').trim(),
    phone: (a.phone || '').trim(),
    notes: (a.notes || '').trim(),
  }
}

function personFromMember(
  a: Attendee,
  m: GroupMember,
  gathering: Gathering,
): ReportPerson {
  const cartePart = personOrderLabel(
    [],
    m.carteItemIds || [],
    m.menuRequest || '',
    gathering,
    '',
  )
  return {
    id: `${a.id}-${m.id}`,
    name: m.name,
    ageGroup: normalizeAgeGroup(m.ageGroup),
    party: a.name,
    menu: personOrderLabel(m.menuItemIds, [], '', gathering, '—'),
    menuRequest: cartePart || '—',
    allergies: (m.allergies || '').trim(),
    email: (a.email || '').trim(),
    phone: (a.phone || '').trim(),
    notes: (a.notes || '').trim(),
  }
}

export function flattenInvitees(gathering: Gathering): ReportPerson[] {
  const people: ReportPerson[] = []
  for (const a of gathering.attendees) {
    if (a.isGroup && a.members?.length) {
      for (const m of a.members) {
        people.push(personFromMember(a, m, gathering))
      }
    } else {
      people.push(personFromSolo(a, gathering))
    }
  }
  return people.sort((x, y) => {
    if (x.ageGroup !== y.ageGroup) return x.ageGroup === 'adult' ? -1 : 1
    return x.name.localeCompare(y.name, undefined, { sensitivity: 'base' })
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function personRows(
  people: ReportPerson[],
  labels: { menu: string; order: string; allergies: string; party: string; contact: string },
): string {
  if (people.length === 0) {
    return `<p class="empty">—</p>`
  }
  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>${escapeHtml(labels.party)}</th>
          <th>${escapeHtml(labels.menu)}</th>
          <th>${escapeHtml(labels.order)}</th>
          <th>${escapeHtml(labels.allergies)}</th>
          <th>${escapeHtml(labels.contact)}</th>
        </tr>
      </thead>
      <tbody>
        ${people
          .map(
            (p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>
              <strong>${escapeHtml(p.name)}</strong>
              ${p.party !== p.name ? `<div class="muted">${escapeHtml(p.party)}</div>` : ''}
              ${p.notes ? `<div class="muted">${escapeHtml(p.notes)}</div>` : ''}
            </td>
            <td>${escapeHtml(p.menu)}</td>
            <td>${escapeHtml(p.menuRequest || '—')}</td>
            <td class="${p.allergies ? 'allergy' : ''}">${escapeHtml(p.allergies || '—')}</td>
            <td>${escapeHtml([p.email, p.phone].filter(Boolean).join(' · ') || '—')}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `
}

export type ReportLabels = {
  title: string
  generated: string
  adults: string
  children: string
  summary: string
  invites: string
  people: string
  menuTotal: string
  stillDue: string
  menu: string
  order: string
  allergies: string
  party: string
  contact: string
  printHint: string
  noGuests: string
  dateTbd: string
  locationTbd: string
}

export function buildEventReportHtml(
  gathering: Gathering,
  labels: ReportLabels,
  localeTag: string,
): string {
  const people = flattenInvitees(gathering)
  const adults = people.filter((p) => p.ageGroup === 'adult')
  const children = people.filter((p) => p.ageGroup === 'child')
  const totals = gatheringTotals(gathering)
  const owed = totals.owed
  const outstanding = totals.outstanding
  const when = [
    formatDate(gathering.date, localeTag, labels.dateTbd),
    gathering.time,
    gathering.location || labels.locationTbd,
  ]
    .filter(Boolean)
    .join(' · ')

  const tableLabels = {
    menu: labels.menu,
    order: labels.order,
    allergies: labels.allergies,
    party: labels.party,
    contact: labels.contact,
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(localeTag)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(labels.title)} — ${escapeHtml(gathering.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Figtree", "Segoe UI", system-ui, sans-serif;
      color: #062823;
      background: #f3f7f5;
      line-height: 1.45;
    }
    .wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem 1.1rem 3rem; }
    h1 { font-family: "Bricolage Grotesque", Georgia, serif; font-size: 1.8rem; margin: 0 0 0.35rem; }
    h2 { font-family: "Bricolage Grotesque", Georgia, serif; font-size: 1.25rem; margin: 1.6rem 0 0.65rem; }
    .meta { color: #5d726c; margin: 0 0 0.35rem; }
    .hint { color: #5d726c; font-size: 0.9rem; margin: 0 0 1.25rem; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; margin: 1rem 0 1.4rem; }
    .card { background: #fff; border: 1px solid rgba(6,40,35,0.1); border-radius: 12px; padding: 0.85rem 1rem; }
    .card span { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #5d726c; font-weight: 700; }
    .card strong { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
    th, td { text-align: left; padding: 0.7rem 0.75rem; border-bottom: 1px solid rgba(6,40,35,0.08); vertical-align: top; font-size: 0.92rem; }
    th { background: #e4eeea; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #1a3d37; }
    .muted { color: #5d726c; font-size: 0.82rem; margin-top: 0.2rem; }
    .allergy { color: #8e2a21; font-weight: 600; }
    .empty { color: #5d726c; }
    .section { margin-bottom: 0.5rem; }
    .count { color: #5d726c; font-weight: 600; font-size: 0.95rem; }
    @media (max-width: 720px) {
      .cards { grid-template-columns: 1fr 1fr; }
      th:nth-child(6), td:nth-child(6) { display: none; }
    }
    @media print {
      body { background: #fff; }
      .hint { display: none; }
      .wrap { max-width: none; padding: 0; }
      .card, table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(gathering.title)}</h1>
    <p class="meta">${escapeHtml(when)}</p>
    <p class="meta">${escapeHtml(labels.generated)}: ${escapeHtml(new Date().toLocaleString(localeTag))}</p>
    <p class="hint">${escapeHtml(labels.printHint)}</p>

    <div class="cards">
      <div class="card"><span>${escapeHtml(labels.invites)}</span><strong>${gathering.attendees.length}</strong></div>
      <div class="card"><span>${escapeHtml(labels.people)}</span><strong>${people.length}</strong></div>
      <div class="card"><span>${escapeHtml(labels.adults)}</span><strong>${adults.length}</strong></div>
      <div class="card"><span>${escapeHtml(labels.children)}</span><strong>${children.length}</strong></div>
    </div>
    <div class="cards">
      <div class="card"><span>${escapeHtml(labels.menuTotal)}</span><strong>${escapeHtml(formatMoney(owed, gathering.currency, localeTag))}</strong></div>
      <div class="card"><span>${escapeHtml(labels.stillDue)}</span><strong>${escapeHtml(formatMoney(outstanding, gathering.currency, localeTag))}</strong></div>
    </div>

    <section class="section">
      <h2>${escapeHtml(labels.adults)} <span class="count">(${adults.length})</span></h2>
      ${adults.length ? personRows(adults, tableLabels) : `<p class="empty">${escapeHtml(labels.noGuests)}</p>`}
    </section>

    <section class="section">
      <h2>${escapeHtml(labels.children)} <span class="count">(${children.length})</span></h2>
      ${children.length ? personRows(children, tableLabels) : `<p class="empty">${escapeHtml(labels.noGuests)}</p>`}
    </section>
  </div>
</body>
</html>`
}

export function openEventReport(html: string) {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
