import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { pickFeedback } from '../lib/feedback'
import type { GatheringInput } from '../types'

type Step = 'title' | 'type' | 'when' | 'where' | 'who' | 'notes'

const STEPS: Step[] = ['title', 'type', 'when', 'where', 'who', 'notes']

const emptyForm: GatheringInput = {
  title: '',
  type: 'lunch',
  date: '',
  time: '13:00',
  location: '',
  notes: '',
  currency: 'EUR',
  organizerName: '',
  organizerEmail: '',
  organizerPhone: '',
}

type Props = {
  onCancel: () => void
  onCreate: (input: GatheringInput) => Promise<void>
}

export function CreateEventChat({ onCancel, onCreate }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('title')
  const [form, setForm] = useState<GatheringInput>(emptyForm)
  const [bubble, setBubble] = useState(() => t('createChatAskTitle'))
  const [reaction, setReaction] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const stepIndex = STEPS.indexOf(step)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  function askFor(next: Step) {
    const prompts: Record<Step, string> = {
      title: t('createChatAskTitle'),
      type: t('createChatAskType'),
      when: t('createChatAskWhen'),
      where: t('createChatAskWhere'),
      who: t('createChatAskWho'),
      notes: t('createChatAskNotes'),
    }
    setBubble(prompts[next])
    setStep(next)
  }

  function reactAndAdvance(keys: readonly string[], next: Step | 'done') {
    const msg = pickFeedback(t, keys as never)
    setReaction(msg)
    window.setTimeout(() => {
      setReaction(null)
      if (next === 'done') return
      askFor(next)
    }, 700)
  }

  async function finish() {
    if (saving || !form.title.trim()) return
    setSaving(true)
    setError(null)
    setBubble(t('createChatCreating'))
    try {
      await onCreate({
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        organizerName: (form.organizerName || '').trim(),
        organizerEmail: (form.organizerEmail || '').trim(),
        organizerPhone: (form.organizerPhone || '').trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createFailed'))
      setBubble(t('createChatAskNotes'))
      setSaving(false)
    }
  }

  function goNextFromTitle(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    reactAndAdvance(
      ['createChatReactTitle1', 'createChatReactTitle2', 'createChatReactTitle3'],
      'type',
    )
  }

  function pickType(type: GatheringInput['type']) {
    setForm((prev) => ({ ...prev, type }))
    reactAndAdvance(
      ['createChatReactType1', 'createChatReactType2', 'createChatReactType3'],
      'when',
    )
  }

  function goNextFromWhen(e: FormEvent) {
    e.preventDefault()
    reactAndAdvance(
      ['createChatReactWhen1', 'createChatReactWhen2', 'createChatReactWhen3'],
      'where',
    )
  }

  function goNextFromWhere(e: FormEvent) {
    e.preventDefault()
    reactAndAdvance(
      form.location.trim()
        ? ['createChatReactWhere1', 'createChatReactWhere2']
        : ['createChatReactSkip1', 'createChatReactSkip2'],
      'who',
    )
  }

  function goNextFromWho(e: FormEvent) {
    e.preventDefault()
    reactAndAdvance(
      form.organizerName?.trim()
        ? ['createChatReactWho1', 'createChatReactWho2']
        : ['createChatReactSkip1', 'createChatReactSkip2'],
      'notes',
    )
  }

  function goNextFromNotes(e: FormEvent) {
    e.preventDefault()
    const msg = pickFeedback(t, [
      'createChatReactNotes1',
      'createChatReactNotes2',
      'createChatReactReady1',
    ] as never)
    setReaction(msg)
    window.setTimeout(() => {
      setReaction(null)
      void finish()
    }, 650)
  }

  function skipWhere() {
    setForm((prev) => ({ ...prev, location: '' }))
    reactAndAdvance(['createChatReactSkip1', 'createChatReactSkip2'], 'who')
  }

  function skipWho() {
    setForm((prev) => ({ ...prev, organizerName: '' }))
    reactAndAdvance(['createChatReactSkip1', 'createChatReactSkip2'], 'notes')
  }

  function skipNotes() {
    setForm((prev) => ({ ...prev, notes: '' }))
    const msg = pickFeedback(t, ['createChatReactReady1', 'createChatReactReady2'] as never)
    setReaction(msg)
    window.setTimeout(() => {
      setReaction(null)
      void finish()
    }, 650)
  }

  return (
    <section className="landing-panel create-chat">
      <div className="landing-panel-head">
        <div className="create-chat-progress" aria-hidden>
          {STEPS.map((key, i) => (
            <span
              key={key}
              className={`create-chat-dot ${i <= stepIndex ? 'on' : ''} ${
                i === stepIndex ? 'current' : ''
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
          disabled={saving}
        >
          {t('backToHome')}
        </button>
      </div>

      <div className="create-chat-bubble" key={bubble + (reaction || '')}>
        <p>{reaction || bubble}</p>
      </div>

      {error && <p className="allergy">{error}</p>}

      {!reaction && !saving && step === 'title' && (
        <form className="create-chat-form" onSubmit={goNextFromTitle}>
          <input
            ref={(el) => {
              inputRef.current = el
            }}
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('placeholderTitle')}
            autoComplete="off"
          />
          <div className="create-chat-actions">
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              {t('backToHome')}
            </button>
            <button className="btn btn-accent" type="submit" disabled={!form.title.trim()}>
              {t('createChatContinue')}
            </button>
          </div>
        </form>
      )}

      {!reaction && !saving && step === 'type' && (
        <div className="create-chat-types">
          {(
            [
              ['lunch', 'typeLunch'],
              ['dinner', 'typeDinner'],
              ['brunch', 'typeBrunch'],
              ['other', 'typeOther'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`create-chat-type ${form.type === value ? 'selected' : ''}`}
              onClick={() => pickType(value)}
            >
              {t(label)}
            </button>
          ))}
        </div>
      )}

      {!reaction && !saving && step === 'when' && (
        <form className="create-chat-form" onSubmit={goNextFromWhen}>
          <div className="create-chat-when">
            <label>
              {t('date')}
              <input
                ref={(el) => {
                  inputRef.current = el
                }}
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              {t('time')}
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          <button className="btn btn-accent" type="submit">
            {t('createChatContinue')}
          </button>
        </form>
      )}

      {!reaction && !saving && step === 'where' && (
        <form className="create-chat-form" onSubmit={goNextFromWhere}>
          <input
            ref={(el) => {
              inputRef.current = el
            }}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t('placeholderLocation')}
            autoComplete="street-address"
          />
          <div className="create-chat-actions">
            <button className="btn btn-ghost" type="button" onClick={skipWhere}>
              {t('createChatSkip')}
            </button>
            <button className="btn btn-accent" type="submit">
              {t('createChatContinue')}
            </button>
          </div>
        </form>
      )}

      {!reaction && !saving && step === 'who' && (
        <form className="create-chat-form" onSubmit={goNextFromWho}>
          <input
            ref={(el) => {
              inputRef.current = el
            }}
            value={form.organizerName || ''}
            onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
            placeholder={t('organizerNamePlaceholder')}
            autoComplete="name"
          />
          <div className="create-chat-actions">
            <button className="btn btn-ghost" type="button" onClick={skipWho}>
              {t('createChatSkip')}
            </button>
            <button className="btn btn-accent" type="submit">
              {t('createChatContinue')}
            </button>
          </div>
        </form>
      )}

      {!reaction && !saving && step === 'notes' && (
        <form className="create-chat-form" onSubmit={goNextFromNotes}>
          <textarea
            ref={(el) => {
              inputRef.current = el
            }}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t('placeholderNotes')}
            rows={3}
          />
          <div className="create-chat-actions">
            <button className="btn btn-ghost" type="button" onClick={skipNotes}>
              {t('createChatSkip')}
            </button>
            <button className="btn btn-accent" type="submit">
              {t('createChatFinish')}
            </button>
          </div>
        </form>
      )}

      {saving && (
        <div className="create-chat-saving" role="status">
          <span className="create-chat-spinner" aria-hidden />
          <p>{t('createChatCreating')}</p>
        </div>
      )}
    </section>
  )
}
