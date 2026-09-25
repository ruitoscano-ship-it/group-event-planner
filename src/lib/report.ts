import type { Attendee, Gathering, GroupMember } from '../types'
import {
  carteLabel,
  formatDate,
  formatMoney,
  gatheringTotals,
  menuLabel,
  normalizeAgeGroup,
} from './money'

export type ReportPerson = {
  id: string
  name: string
  ageGroup: 'adult' | 'child'
  party: string
  menu: string
  carte: string
  extras: string
  allergies: string
  email: string
  phone: string
  notes: string
}

export type CarteTally = {
  id: string
  name: string
  count: number
}

function personFromSolo(a: Attendee, gathering: Gathering): ReportPerson {
  return {
    id: a.id,
    name: a.name,
    ageGroup: normalizeAgeGroup(a.ageGroup),
    party: a.name,
    menu: menuLabel(a.menuItemIds, gathering.menu, '—'),
    carte: carteLabel(a.carteItemIds || [], gathering.carteItems || [], '—'),
    extras: (a.menuRequest || '').trim() || '—',
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
  return {
    id: `${a.id}-${m.id}`,
    name: m.name,
    ageGroup: normalizeAgeGroup(m.ageGroup),
    party: a.name,
    menu: menuLabel(m.menuItemIds, gathering.menu, '—'),
    carte: carteLabel(m.carteItemIds || [], gathering.carteItems || [], '—'),
    extras: (m.menuRequest || '').trim() || '—',
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

/** Count how many times each approved carte dish was picked. */
export function tallyCartePicks(gathering: Gathering): CarteTally[] {
  const counts = new Map<string, number>()
  const bump = (ids: string[] | undefined) => {
    for (const id of ids || []) {
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }
  for (const a of gathering.attendees) {
    if (a.isGroup && a.members?.length) {
      for (const m of a.members) bump(m.carteItemIds)
    } else {
      bump(a.carteItemIds)
    }
  }
  return (gathering.carteItems || [])
    .map((item) => ({
      id: item.id,
      name: item.name,
      count: counts.get(item.id) || 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function personCards(
  people: ReportPerson[],
  labels: {
    menu: string
    carte: string
    extras: string
    allergies: string
    party: string
    contact: string
  },
): string {
  if (people.length === 0) {
    return `<p class="empty">—</p>`
  }
  return `
    <div class="people">
      ${people
        .map((p, i) => {
          const contact = [p.email, p.phone].filter(Boolean).join(' · ')
          return `
        <article class="person">
          <header class="person-head">
            <span class="person-num">${i + 1}</span>
            <div class="person-who">
              <strong>${escapeHtml(p.name)}</strong>
              ${p.party !== p.name ? `<div class="muted">${escapeHtml(p.party)}</div>` : ''}
              ${p.notes ? `<div class="muted">${escapeHtml(p.notes)}</div>` : ''}
            </div>
          </header>
          <dl class="person-fields">
            <div>
              <dt>${escapeHtml(labels.menu)}</dt>
              <dd>${escapeHtml(p.menu)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(labels.carte)}</dt>
              <dd>${escapeHtml(p.carte)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(labels.extras)}</dt>
              <dd>${escapeHtml(p.extras)}</dd>
            </div>
            <div>
              <dt>${escapeHtml(labels.allergies)}</dt>
              <dd class="${p.allergies ? 'allergy' : ''}">${escapeHtml(p.allergies || '—')}</dd>
            </div>
            <div class="person-contact">
              <dt>${escapeHtml(labels.contact)}</dt>
              <dd>${escapeHtml(contact || '—')}</dd>
            </div>
          </dl>
        </article>`
        })
        .join('')}
    </div>
  `
}

function carteTallyRows(rows: CarteTally[]): string {
  if (rows.length === 0) return ''
  return `
    <ul class="tally-list">
      ${rows
        .map(
          (row) => `
        <li>
          <span>${escapeHtml(row.name)}</span>
          <strong>${row.count}</strong>
        </li>`,
        )
        .join('')}
    </ul>
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
  carte: string
  extras: string
  allergies: string
  party: string
  contact: string
  printHint: string
  noGuests: string
  dateTbd: string
  locationTbd: string
  carteTally: string
  dish: string
  qty: string
  noCartePicks: string
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
  const carteTally = tallyCartePicks(gathering)
  const when = [
    formatDate(gathering.date, localeTag, labels.dateTbd),
    gathering.time,
    gathering.location || labels.locationTbd,
  ]
    .filter(Boolean)
    .join(' · ')

  const tableLabels = {
    menu: labels.menu,
    carte: labels.carte,
    extras: labels.extras,
    allergies: labels.allergies,
    party: labels.party,
    contact: labels.contact,
  }

  const showCarteSection =
    Boolean(gathering.carteApproved) && (gathering.carteItems || []).length > 0

  return `<!DOCTYPE html>
<html lang="${escapeHtml(localeTag)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(labels.title)} — ${escapeHtml(gathering.title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      font-family: "Figtree", "Segoe UI", system-ui, sans-serif;
      color: #062823;
      background: #f3f7f5;
      line-height: 1.45;
    }
    .wrap {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.1rem 0.9rem calc(2.5rem + env(safe-area-inset-bottom, 0px));
      padding-left: max(0.9rem, env(safe-area-inset-left, 0px));
      padding-right: max(0.9rem, env(safe-area-inset-right, 0px));
    }
    h1 {
      font-family: "Bricolage Grotesque", Georgia, serif;
      font-size: clamp(1.45rem, 5.5vw, 1.85rem);
      margin: 0 0 0.35rem;
      line-height: 1.15;
      word-break: break-word;
    }
    h2 {
      font-family: "Bricolage Grotesque", Georgia, serif;
      font-size: clamp(1.1rem, 4.2vw, 1.25rem);
      margin: 1.45rem 0 0.65rem;
    }
    .meta { color: #5d726c; margin: 0 0 0.35rem; font-size: 0.92rem; word-break: break-word; }
    .hint { color: #5d726c; font-size: 0.88rem; margin: 0 0 1.1rem; }
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      margin: 0.9rem 0 1.1rem;
    }
    .card {
      background: #fff;
      border: 1px solid rgba(6,40,35,0.1);
      border-radius: 12px;
      padding: 0.8rem 0.9rem;
      min-width: 0;
    }
    .card span {
      display: block;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #5d726c;
      font-weight: 700;
    }
    .card strong {
      font-size: clamp(1.05rem, 4vw, 1.25rem);
      word-break: break-word;
    }
    .tally-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
      max-width: 480px;
    }
    .tally-list li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.7rem 0.85rem;
      background: #fff;
      border: 1px solid rgba(6,40,35,0.1);
      border-radius: 12px;
    }
    .tally-list li span { min-width: 0; word-break: break-word; }
    .tally-list li strong {
      flex-shrink: 0;
      min-width: 1.75rem;
      text-align: right;
      color: #004f46;
    }
    .people { display: grid; gap: 0.7rem; }
    .person {
      background: #fff;
      border: 1px solid rgba(6,40,35,0.1);
      border-radius: 14px;
      overflow: hidden;
    }
    .person-head {
      display: flex;
      gap: 0.7rem;
      align-items: flex-start;
      padding: 0.85rem 0.9rem;
      background: #eaf3f0;
      border-bottom: 1px solid rgba(6,40,35,0.08);
    }
    .person-num {
      flex-shrink: 0;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #006b5f;
      color: #fff;
      font-size: 0.78rem;
      font-weight: 800;
    }
    .person-who { min-width: 0; }
    .person-who strong {
      display: block;
      font-size: 1.02rem;
      word-break: break-word;
    }
    .person-fields {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      margin: 0;
    }
    .person-fields > div {
      display: grid;
      grid-template-columns: minmax(5.5rem, 32%) 1fr;
      gap: 0.55rem;
      padding: 0.65rem 0.9rem;
      border-bottom: 1px solid rgba(6,40,35,0.06);
      align-items: start;
    }
    .person-fields > div:last-child { border-bottom: 0; }
    .person-fields dt {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #5d726c;
      padding-top: 0.15rem;
    }
    .person-fields dd {
      margin: 0;
      font-size: 0.92rem;
      word-break: break-word;
    }
    .muted { color: #5d726c; font-size: 0.82rem; margin-top: 0.2rem; }
    .allergy { color: #8e2a21; font-weight: 600; }
    .empty { color: #5d726c; }
    .section { margin-bottom: 0.35rem; }
    .count { color: #5d726c; font-weight: 600; font-size: 0.92rem; }
    @media (min-width: 640px) {
      .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .wrap { padding: 1.5rem 1.15rem 3rem; }
      .person-fields {
        grid-template-columns: 1fr 1fr;
      }
      .person-fields > div {
        border-right: 1px solid rgba(6,40,35,0.06);
      }
      .person-fields > div:nth-child(2n) { border-right: 0; }
      .person-contact { grid-column: 1 / -1; border-right: 0 !important; }
    }
    @media print {
      body { background: #fff; }
      .hint { display: none; }
      .wrap { max-width: none; padding: 0; }
      .card, .person, .tally-list li { break-inside: avoid; }
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

    ${
      showCarteSection
        ? `<section class="section">
      <h2>${escapeHtml(labels.carteTally)}</h2>
      ${
        carteTally.length
          ? carteTallyRows(carteTally)
          : `<p class="empty">${escapeHtml(labels.noCartePicks)}</p>`
      }
    </section>`
        : ''
    }

    <section class="section">
      <h2>${escapeHtml(labels.adults)} <span class="count">(${adults.length})</span></h2>
      ${adults.length ? personCards(adults, tableLabels) : `<p class="empty">${escapeHtml(labels.noGuests)}</p>`}
    </section>

    <section class="section">
      <h2>${escapeHtml(labels.children)} <span class="count">(${children.length})</span></h2>
      ${children.length ? personCards(children, tableLabels) : `<p class="empty">${escapeHtml(labels.noGuests)}</p>`}
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
