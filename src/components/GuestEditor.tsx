import { useEffect, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import {
  createMemberDraft,
  formatMoney,
  menuLabel,
  partySize,
  selectionHasAlaCarte,
  toggleMenuSelection,
  attendeeTotal,
} from '../lib/money'
import type { Attendee, Gathering, GroupMember } from '../types'
import { AgeGroupPicker } from './AgeGroupPicker'
import { MenuPicker } from './MenuPicker'

type Props = {
  gathering: Gathering
  attendee: Attendee
  editing: boolean
  onToggleEdit: () => void
  onSave: (patch: Partial<Attendee>) => Promise<void>
  onRemove: () => void
}

export function GuestEditor({
  gathering,
  attendee,
  editing,
  onToggleEdit,
  onSave,
  onRemove,
}: Props) {
  const { t, localeTag } = useI18n()
  const [draft, setDraft] = useState(attendee)
  const [members, setMembers] = useState<GroupMember[]>(
    attendee.members?.length ? attendee.members : [],
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!editing) return
    setMembers(
      attendee.members?.length
        ? attendee.members.map((m) => ({
            ...m,
            menuRequest: m.menuRequest || '',
            ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
          }))
        : [],
    )
    setDraft({
      ...attendee,
      ageGroup: attendee.ageGroup === 'child' ? 'child' : 'adult',
      menuRequest: attendee.menuRequest || '',
    })
    setMsg(null)
    setError(false)
  }, [attendee, editing])

  const owed = attendeeTotal(attendee, gathering.menu)
  const variable = selectionHasAlaCarte(attendee, gathering.menu)
  const showMenuRequest = Boolean(gathering.menuCardUrl)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (busy || !draft.name.trim()) return
    setBusy(true)
    setMsg(null)
    setError(false)
    try {
      await onSave({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        allergies: draft.isGroup ? '' : draft.allergies.trim(),
        notes: draft.notes.trim(),
        menuRequest: draft.isGroup ? '' : draft.menuRequest.trim(),
        ageGroup: draft.isGroup ? 'adult' : draft.ageGroup === 'child' ? 'child' : 'adult',
        menuItemIds: draft.isGroup ? [] : draft.menuItemIds,
        isGroup: draft.isGroup,
        members: draft.isGroup
          ? members.map((m) => ({
              ...m,
              name: m.name.trim(),
              allergies: m.allergies.trim(),
              menuRequest: m.menuRequest.trim(),
              ageGroup: m.ageGroup === 'child' ? 'child' : 'adult',
            }))
          : [],
        groupSize: draft.isGroup ? Math.max(1, members.length) : 1,
      })
      setMsg(t('guestUpdated'))
    } catch (err) {
      setError(true)
      setMsg(err instanceof Error ? err.message : t('guestUpdateFailed'))
    } finally {
      setBusy(false)
    }
  }

  function updateMember(id: string, patch: Partial<GroupMember>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  return (
    <div className={`guest-row ${editing ? 'guest-row-editing' : ''}`}>
      <div style={{ width: '100%' }}>
        <div className="guest-row-head">
          <div>
            <h4>{attendee.name}</h4>
            <p>
              {t('registeredBy', { name: attendee.registeredBy })}
              {attendee.registeredBy !== attendee.name ? ` ${t('forSomeoneElse')}` : ''}
            </p>
            {(attendee.email || attendee.phone) && (
              <p className="sub" style={{ marginTop: '0.25rem' }}>
                {[attendee.email, attendee.phone].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="row-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={onToggleEdit}>
              {editing ? t('cancel') : t('editGuest')}
            </button>
            <button className="btn btn-danger btn-sm" type="button" onClick={onRemove}>
              {t('remove')}
            </button>
          </div>
        </div>

        {!editing && (
          <>
            <div className="guest-meta">
              {attendee.isGroup && (
                <span className="chip chip-warm">
                  {t('groupBadge', { count: partySize(attendee) })}
                </span>
              )}
              {!attendee.isGroup && (
                <span className="chip">
                  {attendee.ageGroup === 'child' ? t('ageChild') : t('ageAdult')}
                </span>
              )}
              {!attendee.isGroup || !attendee.members?.length ? (
                <span className="chip">
                  {menuLabel(attendee.menuItemIds, gathering.menu, t('noSelection'))}
                </span>
              ) : null}
              {attendee.menuRequest && (
                <span className="chip chip-muted">{attendee.menuRequest}</span>
              )}
              <span className="chip chip-warm">
                {formatMoney(owed, gathering.currency, localeTag)}
                {variable ? ' +' : ''}
              </span>
              {variable && <span className="chip chip-muted">{t('alaCarte')}</span>}
              {attendee.allergies && (
                <span className="chip chip-allergy">
                  {t('allergy', { value: attendee.allergies })}
                </span>
              )}
            </div>
            {attendee.isGroup && attendee.members?.length ? (
              <ul className="member-picks">
                {attendee.members.map((m) => (
                  <li key={m.id}>
                    <strong>{m.name}</strong>
                    {' · '}
                    {m.ageGroup === 'child' ? t('ageChild') : t('ageAdult')}
                    {' · '}
                    {menuLabel(m.menuItemIds, gathering.menu, t('noSelection'))}
                    {m.menuRequest ? ` · ${m.menuRequest}` : ''}
                    {m.allergies ? (
                      <>
                        {' · '}
                        <span className="allergy">{m.allergies}</span>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {attendee.notes && <p style={{ marginTop: '0.5rem' }}>{attendee.notes}</p>}
          </>
        )}

        {editing && (
          <form className="guest-edit-form" onSubmit={(e) => void handleSave(e)}>
            {msg && (
              <div
                className={`feedback-banner ${error ? 'error' : ''}`}
                role="status"
              >
                {msg}
              </div>
            )}
            <div className="form-grid">
              <label className="full">
                {draft.isGroup ? t('groupName') : t('guestName')}
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                {t('emailOptional')}
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </label>
              <label>
                {t('phoneOptional')}
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              {!draft.isGroup && (
                <>
                  <div className="full">
                    <AgeGroupPicker
                      value={draft.ageGroup === 'child' ? 'child' : 'adult'}
                      onChange={(value) => setDraft({ ...draft, ageGroup: value })}
                    />
                  </div>
                  <label className="full">
                    {t('allergiesDietary')}
                    <input
                      value={draft.allergies}
                      onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label className="full">
                {t('notes')}
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </div>

            {draft.isGroup ? (
              <>
                <h4 style={{ margin: '1rem 0 0.35rem' }}>{t('groupMembersTitle')}</h4>
                <div className="member-list">
                  {members.map((member, index) => (
                    <div key={member.id} className="member-card">
                      <div className="member-card-head">
                        <h4>{t('memberLabel', { n: index + 1 })}</h4>
                        {members.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              setMembers((prev) => prev.filter((m) => m.id !== member.id))
                            }
                          >
                            {t('removeMember')}
                          </button>
                        )}
                      </div>
                      <label>
                        {t('memberName')}
                        <input
                          required
                          value={member.name}
                          onChange={(e) =>
                            updateMember(member.id, { name: e.target.value })
                          }
                        />
                      </label>
                      <AgeGroupPicker
                        value={member.ageGroup || 'adult'}
                        onChange={(value) =>
                          updateMember(member.id, { ageGroup: value })
                        }
                      />
                      <label>
                        {t('allergiesDietary')}
                        <input
                          value={member.allergies}
                          onChange={(e) =>
                            updateMember(member.id, { allergies: e.target.value })
                          }
                        />
                      </label>
                      {gathering.menu.length > 0 && (
                        <MenuPicker
                          menu={gathering.menu}
                          selectedIds={member.menuItemIds}
                          currency={gathering.currency}
                          onToggle={(itemId) =>
                            updateMember(member.id, {
                              menuItemIds: toggleMenuSelection(
                                member.menuItemIds,
                                itemId,
                                gathering.menu,
                              ),
                            })
                          }
                          emptyLabel={t('organizerNoMenu')}
                        />
                      )}
                      {showMenuRequest && (
                        <label>
                          {t('menuRequest')}
                          <textarea
                            value={member.menuRequest}
                            onChange={(e) =>
                              updateMember(member.id, { menuRequest: e.target.value })
                            }
                            placeholder={t('menuRequestPlaceholder')}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setMembers((prev) => [...prev, createMemberDraft()])}
                >
                  {t('addMember')}
                </button>
              </>
            ) : (
              <>
                {gathering.menu.length > 0 && (
                  <>
                    <h4 style={{ margin: '1rem 0 0.35rem' }}>{t('pickFromMenu')}</h4>
                    <MenuPicker
                      menu={gathering.menu}
                      selectedIds={draft.menuItemIds}
                      currency={gathering.currency}
                      onToggle={(itemId) =>
                        setDraft((prev) => ({
                          ...prev,
                          menuItemIds: toggleMenuSelection(
                            prev.menuItemIds,
                            itemId,
                            gathering.menu,
                          ),
                        }))
                      }
                      emptyLabel={t('organizerNoMenu')}
                    />
                  </>
                )}
                {showMenuRequest && (
                  <label className="full" style={{ display: 'block', marginTop: '0.75rem' }}>
                    {t('menuRequest')}
                    <textarea
                      value={draft.menuRequest}
                      onChange={(e) =>
                        setDraft({ ...draft, menuRequest: e.target.value })
                      }
                      placeholder={t('menuRequestPlaceholder')}
                    />
                  </label>
                )}
              </>
            )}

            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-accent" type="submit" disabled={busy}>
                {busy ? t('saving') : t('saveGuest')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
