import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nContext'
import {
  attendeePaidTotal,
  attendeeRemaining,
  attendeeSettled,
  attendeeTotal,
  formatMoney,
  idsHaveAlaCarte,
  legacyUnallocatedPaid,
  partySize,
  personMenuOwed,
  personOrderLabel,
  personRemaining,
  personTotal,
  isPersonSettled,
} from '../lib/money'
import {
  mailtoNudgeUrl,
  smsNudgeUrl,
  unpaidNudgeText,
  whatsappNudgeUrl,
} from '../lib/nudgeLinks'
import type { Attendee, Gathering, GroupMember } from '../types'

type PartyFilter = 'all' | 'individuals' | 'groups'
type StatusFilter = 'all' | 'outstanding' | 'settled'

type PersonDraft = {
  extraAmount: string
  amountPaid: string
}

type Props = {
  gathering: Gathering
  onUpdateAttendee: (
    attendeeId: string,
    patch: Partial<Attendee>,
  ) => Promise<void>
}

function draftFromPerson(extraAmount: number, amountPaid: number): PersonDraft {
  return {
    extraAmount: String(extraAmount || 0),
    amountPaid: String(amountPaid || 0),
  }
}

function parseAmount(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function NudgeLinks({
  name,
  email,
  phone,
  amountLabel,
  eventTitle,
}: {
  name: string
  email: string
  phone: string
  amountLabel: string
  eventTitle: string
}) {
  const { t, locale } = useI18n()
  const text = unpaidNudgeText({
    guestName: name,
    eventTitle,
    amountLabel,
    locale,
  })
  const subject = t('nudgeSubject', { title: eventTitle })
  const wa = whatsappNudgeUrl(phone, text)
  const sms = smsNudgeUrl(phone, text)
  const mail = mailtoNudgeUrl(email, subject, text)
  if (!wa && !sms && !mail) return null
  return (
    <div className="nudge-links">
      {wa && (
        <a className="btn btn-sm btn-ghost" href={wa} target="_blank" rel="noreferrer">
          {t('nudgeWhatsApp')}
        </a>
      )}
      {sms && (
        <a className="btn btn-sm btn-ghost" href={sms}>
          {t('nudgeSms')}
        </a>
      )}
      {mail && (
        <a className="btn btn-sm btn-ghost" href={mail}>
          {t('nudgeEmail')}
        </a>
      )}
    </div>
  )
}

export function PaymentBoard({ gathering, onUpdateAttendee }: Props) {
  const { t, localeTag } = useI18n()
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, PersonDraft>>({})

  useEffect(() => {
    const next: Record<string, PersonDraft> = {}
    for (const a of gathering.attendees) {
      if (a.isGroup && a.members?.length) {
        for (const m of a.members) {
          next[`${a.id}:${m.id}`] = draftFromPerson(m.extraAmount || 0, m.amountPaid || 0)
        }
      } else {
        next[a.id] = draftFromPerson(a.extraAmount || 0, a.amountPaid || 0)
      }
    }
    setDrafts(next)
  }, [gathering.attendees])

  const filtered = useMemo(() => {
    return gathering.attendees.filter((a) => {
      if (partyFilter === 'individuals' && a.isGroup) return false
      if (partyFilter === 'groups' && !a.isGroup) return false
      const settled = attendeeSettled(a, gathering.menu)
      if (statusFilter === 'settled' && !settled) return false
      if (statusFilter === 'outstanding' && settled) return false
      return true
    })
  }, [gathering.attendees, gathering.menu, partyFilter, statusFilter])

  function setDraft(key: string, patch: Partial<PersonDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || draftFromPerson(0, 0)), ...patch },
    }))
  }

  async function saveIndividual(attendee: Attendee, draft: PersonDraft) {
    const key = attendee.id
    if (busyKey) return
    setBusyKey(key)
    try {
      await onUpdateAttendee(attendee.id, {
        extraAmount: parseAmount(draft.extraAmount),
        amountPaid: parseAmount(draft.amountPaid),
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function saveMember(
    attendee: Attendee,
    memberId: string,
    draft: PersonDraft,
    clearParentPaid = false,
  ) {
    const key = `${attendee.id}:${memberId}`
    if (busyKey) return
    setBusyKey(key)
    try {
      const members = (attendee.members || []).map((m) =>
        m.id === memberId
          ? {
              ...m,
              extraAmount: parseAmount(draft.extraAmount),
              amountPaid: parseAmount(draft.amountPaid),
            }
          : {
              ...m,
              amountPaid: m.amountPaid || 0,
              extraAmount: m.extraAmount || 0,
            },
      )
      await onUpdateAttendee(attendee.id, {
        members,
        ...(clearParentPaid || parseAmount(draft.amountPaid) > 0
          ? { amountPaid: 0 }
          : {}),
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function markIndividualPaid(attendee: Attendee) {
    const menuOwed =
      personMenuOwed(attendee.menuItemIds, gathering.menu) * (attendee.isGroup ? partySize(attendee) : 1)
    const draft = drafts[attendee.id] || draftFromPerson(attendee.extraAmount || 0, 0)
    const extras = parseAmount(draft.extraAmount)
    const owed = personTotal(menuOwed, extras)
    setDraft(attendee.id, { amountPaid: String(owed) })
    setBusyKey(attendee.id)
    try {
      await onUpdateAttendee(attendee.id, {
        extraAmount: extras,
        amountPaid: owed,
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function markMemberPaid(attendee: Attendee, member: GroupMember) {
    const key = `${attendee.id}:${member.id}`
    const menuOwed = personMenuOwed(member.menuItemIds, gathering.menu)
    const draft = drafts[key] || draftFromPerson(member.extraAmount || 0, 0)
    const extras = parseAmount(draft.extraAmount)
    const owed = personTotal(menuOwed, extras)
    const nextDraft = { extraAmount: String(extras), amountPaid: String(owed) }
    setDraft(key, nextDraft)
    await saveMember(attendee, member.id, nextDraft, true)
  }

  async function resetIndividual(attendee: Attendee) {
    setDraft(attendee.id, { amountPaid: '0' })
    setBusyKey(attendee.id)
    try {
      await onUpdateAttendee(attendee.id, { amountPaid: 0 })
    } finally {
      setBusyKey(null)
    }
  }

  async function resetMember(attendee: Attendee, member: GroupMember) {
    const key = `${attendee.id}:${member.id}`
    const draft = {
      extraAmount: String(
        parseAmount(drafts[key]?.extraAmount ?? String(member.extraAmount || 0)),
      ),
      amountPaid: '0',
    }
    setDraft(key, draft)
    await saveMember(attendee, member.id, draft)
  }

  async function splitUnallocated(attendee: Attendee) {
    const unallocated = legacyUnallocatedPaid(attendee)
    const members = attendee.members || []
    if (!unallocated || members.length === 0 || busyKey) return
    setBusyKey(attendee.id)
    try {
      const base = Math.floor((unallocated / members.length) * 100) / 100
      let remainder = Math.round((unallocated - base * members.length) * 100) / 100
      const nextMembers = members.map((m, i) => {
        const extra = i === 0 ? remainder : 0
        if (i === 0) remainder = 0
        return {
          ...m,
          amountPaid: base + extra,
          extraAmount: m.extraAmount || 0,
        }
      })
      await onUpdateAttendee(attendee.id, {
        amountPaid: 0,
        members: nextMembers,
      })
    } finally {
      setBusyKey(null)
    }
  }

  if (gathering.attendees.length === 0) {
    return <div className="empty">{t('noGuestsToBill')}</div>
  }

  return (
    <div className="payment-board">
      <div className="payment-filters" role="group" aria-label={t('paymentFilters')}>
        <div className="payment-filter-row">
          <span className="payment-filter-label">{t('paymentFilterParty')}</span>
          {(
            [
              ['all', 'paymentFilterAll'],
              ['individuals', 'paymentFilterIndividuals'],
              ['groups', 'paymentFilterGroups'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip payment-filter-chip ${partyFilter === value ? 'selected' : 'chip-muted'}`}
              aria-pressed={partyFilter === value}
              onClick={() => setPartyFilter(value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="payment-filter-row">
          <span className="payment-filter-label">{t('paymentFilterStatus')}</span>
          {(
            [
              ['all', 'paymentFilterAll'],
              ['outstanding', 'paymentFilterOutstanding'],
              ['settled', 'paymentFilterSettled'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip payment-filter-chip ${statusFilter === value ? 'selected' : 'chip-muted'}`}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{t('paymentFilterEmpty')}</div>
      ) : (
        <div className="guest-list payment-list">
          {filtered.map((a) => {
            if (a.isGroup && a.members?.length) {
              return (
                <GroupPaymentCard
                  key={a.id}
                  attendee={a}
                  gathering={gathering}
                  drafts={drafts}
                  busyKey={busyKey}
                  onDraft={setDraft}
                  onSaveMember={(memberId, draft) => void saveMember(a, memberId, draft)}
                  onMarkPaid={(m) => void markMemberPaid(a, m)}
                  onReset={(m) => void resetMember(a, m)}
                  onSplit={() => void splitUnallocated(a)}
                />
              )
            }

            const key = a.id
            const draft = drafts[key] || draftFromPerson(a.extraAmount || 0, a.amountPaid || 0)
            const menuOwed =
              personMenuOwed(a.menuItemIds, gathering.menu) *
              (a.isGroup ? partySize(a) : 1)
            const extras = parseAmount(draft.extraAmount)
            const paid = parseAmount(draft.amountPaid)
            const due = personRemaining(menuOwed, extras, paid)
            const settled = isPersonSettled(menuOwed, extras, paid)
            const hasAla = idsHaveAlaCarte(a.menuItemIds, gathering.menu)
            const busy = busyKey === key

            return (
              <div key={a.id} className="guest-row payment-row">
                <div>
                  <h4>{a.name}</h4>
                  <p>
                    {personOrderLabel(
                      a.menuItemIds,
                      a.carteItemIds || [],
                      a.menuRequest || '',
                      gathering,
                      t('noSelection'),
                    )}
                  </p>
                  <PersonMoneyFields
                    currency={gathering.currency}
                    localeTag={localeTag}
                    menuOwed={menuOwed}
                    draft={draft}
                    due={due}
                    settled={settled}
                    hasAla={hasAla}
                    extrasHint={hasAla && extras <= 0}
                    busy={busy}
                    onDraft={(patch) => setDraft(key, patch)}
                    onBlurSave={(next) => void saveIndividual(a, next)}
                    onMarkPaid={() => void markIndividualPaid(a)}
                    onReset={() => void resetIndividual(a)}
                    nudge={
                      !settled && due > 0.001 ? (
                        <NudgeLinks
                          name={a.name}
                          email={a.email || ''}
                          phone={a.phone || ''}
                          amountLabel={formatMoney(due, gathering.currency, localeTag)}
                          eventTitle={gathering.title}
                        />
                      ) : null
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function GroupPaymentCard({
  attendee,
  gathering,
  drafts,
  busyKey,
  onDraft,
  onSaveMember,
  onMarkPaid,
  onReset,
  onSplit,
}: {
  attendee: Attendee
  gathering: Gathering
  drafts: Record<string, PersonDraft>
  busyKey: string | null
  onDraft: (key: string, patch: Partial<PersonDraft>) => void
  onSaveMember: (memberId: string, draft: PersonDraft) => void
  onMarkPaid: (member: GroupMember) => void
  onReset: (member: GroupMember) => void
  onSplit: () => void
}) {
  const { t, localeTag } = useI18n()
  const owed = attendeeTotal(attendee, gathering.menu)
  const paid = attendeePaidTotal(attendee)
  const remaining = attendeeRemaining(attendee, gathering.menu)
  const settled = attendeeSettled(attendee, gathering.menu)
  const unallocated = legacyUnallocatedPaid(attendee)

  return (
    <div className="guest-row payment-row payment-group">
      <div>
        <div className="payment-group-head">
          <div>
            <h4>{attendee.name}</h4>
            <p>{t('groupBadge', { count: partySize(attendee) })}</p>
          </div>
          <div className="guest-meta">
            <span className="chip chip-muted">
              {t('owes', {
                amount: formatMoney(owed, gathering.currency, localeTag),
              })}
            </span>
            <span className={`chip ${settled ? '' : 'chip-warm'}`}>
              {settled
                ? t('paidInFull')
                : t('dueAmount', {
                    amount: formatMoney(remaining, gathering.currency, localeTag),
                  })}
            </span>
            <span className="chip chip-muted">
              {t('paymentPaidCol')}:{' '}
              {formatMoney(paid, gathering.currency, localeTag)}
            </span>
          </div>
        </div>

        {unallocated > 0 && (
          <div className="payment-unallocated" role="status">
            <p>
              {t('paymentUnallocated', {
                amount: formatMoney(unallocated, gathering.currency, localeTag),
              })}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-accent"
              disabled={busyKey === attendee.id}
              onClick={onSplit}
            >
              {t('paymentSplitEqually')}
            </button>
          </div>
        )}

        <div className="payment-members">
          {attendee.members.map((m) => {
            const key = `${attendee.id}:${m.id}`
            const draft =
              drafts[key] || draftFromPerson(m.extraAmount || 0, m.amountPaid || 0)
            const menuOwed = personMenuOwed(m.menuItemIds, gathering.menu)
            const extras = parseAmount(draft.extraAmount)
            const paidAmt = parseAmount(draft.amountPaid)
            const due = personRemaining(menuOwed, extras, paidAmt)
            const personSettled = isPersonSettled(menuOwed, extras, paidAmt)
            const hasAla = idsHaveAlaCarte(m.menuItemIds, gathering.menu)

            return (
              <div key={m.id} className="payment-member">
                <h5>{m.name}</h5>
                <p>
                  {personOrderLabel(
                    m.menuItemIds,
                    m.carteItemIds || [],
                    m.menuRequest || '',
                    gathering,
                    t('noSelection'),
                  )}
                </p>
                <PersonMoneyFields
                  currency={gathering.currency}
                  localeTag={localeTag}
                  menuOwed={menuOwed}
                  draft={draft}
                  due={due}
                  settled={personSettled}
                  hasAla={hasAla}
                  extrasHint={hasAla && extras <= 0}
                  busy={busyKey === key}
                  onDraft={(patch) => onDraft(key, patch)}
                  onBlurSave={(next) => onSaveMember(m.id, next)}
                  onMarkPaid={() => onMarkPaid(m)}
                  onReset={() => onReset(m)}
                  nudge={
                    !personSettled && due > 0.001 ? (
                      <NudgeLinks
                        name={m.name}
                        email={attendee.email || ''}
                        phone={attendee.phone || ''}
                        amountLabel={formatMoney(due, gathering.currency, localeTag)}
                        eventTitle={gathering.title}
                      />
                    ) : null
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PersonMoneyFields({
  currency,
  localeTag,
  menuOwed,
  draft,
  due,
  settled,
  hasAla,
  extrasHint,
  busy,
  onDraft,
  onBlurSave,
  onMarkPaid,
  onReset,
  nudge,
}: {
  currency: string
  localeTag: string
  menuOwed: number
  draft: PersonDraft
  due: number
  settled: boolean
  hasAla: boolean
  extrasHint: boolean
  busy: boolean
  onDraft: (patch: Partial<PersonDraft>) => void
  onBlurSave: (next: PersonDraft) => void
  onMarkPaid: () => void
  onReset: () => void
  nudge?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <>
      <div className="guest-meta">
        <span className="chip chip-muted">
          {t('paymentMenuCol')}: {formatMoney(menuOwed, currency, localeTag)}
        </span>
        {hasAla && <span className="chip chip-warm">{t('priceVariable')}</span>}
        <span className={`chip ${settled ? '' : 'chip-warm'}`}>
          {settled
            ? t('paidInFull')
            : t('dueAmount', {
                amount: formatMoney(due, currency, localeTag),
              })}
        </span>
      </div>
      {extrasHint && <p className="payment-extras-hint">{t('paymentExtrasHint')}</p>}
      <div className="money-inputs payment-money">
        <label>
          {t('paymentExtrasCol')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.extraAmount}
            disabled={busy}
            onChange={(e) => onDraft({ extraAmount: e.target.value })}
            onBlur={(e) => {
              const next = { ...draft, extraAmount: e.target.value }
              onDraft(next)
              onBlurSave(next)
            }}
          />
        </label>
        <label>
          {t('amountPaid')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.amountPaid}
            disabled={busy}
            onChange={(e) => onDraft({ amountPaid: e.target.value })}
            onBlur={(e) => {
              const next = { ...draft, amountPaid: e.target.value }
              onDraft(next)
              onBlurSave(next)
            }}
          />
        </label>
        <div className="row-actions">
          <button
            className="btn btn-sm btn-accent"
            type="button"
            disabled={busy}
            onClick={onMarkPaid}
          >
            {t('markPaid')}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            disabled={busy}
            onClick={onReset}
          >
            {t('reset')}
          </button>
        </div>
      </div>
      {nudge}
    </>
  )
}
