import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { ocrMenuImage, saveCachedOcrLines } from '../lib/menuOcr'
import type { CarteItem, Gathering } from '../types'

type Props = {
  gathering: Gathering
  onSave: (items: CarteItem[], approved: boolean) => Promise<void>
}

function newCarteId(): string {
  return `carte_${crypto.randomUUID().slice(0, 8)}`
}

function fromLines(lines: string[]): CarteItem[] {
  return lines
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: newCarteId(), name }))
}

export function EventCarteEditor({ gathering, onSave }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<CarteItem[]>(() =>
    (gathering.carteItems || []).map((item) => ({ ...item })),
  )
  const [approved, setApproved] = useState(Boolean(gathering.carteApproved))
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    setDraft((gathering.carteItems || []).map((item) => ({ ...item })))
    setApproved(Boolean(gathering.carteApproved))
  }, [gathering.carteItems, gathering.carteApproved])

  async function runOcr() {
    if (!gathering.menuCardUrl || ocrBusy) return
    setOcrBusy(true)
    setError(false)
    setMsg(null)
    setOcrProgress(0)
    try {
      const lines = await ocrMenuImage(gathering.menuCardUrl, setOcrProgress)
      if (lines.length === 0) {
        setError(true)
        setMsg(t('ocrNoText'))
        return
      }
      saveCachedOcrLines(gathering.menuCardUrl, lines)
      const existing = new Set(draft.map((d) => d.name.toLowerCase()))
      const additions = fromLines(lines).filter(
        (item) => !existing.has(item.name.toLowerCase()),
      )
      setDraft((prev) => [...prev, ...additions].slice(0, 120))
      setApproved(false)
      setMsg(t('ocrFound', { count: lines.length }))
    } catch (err) {
      setError(true)
      setMsg(err instanceof Error ? err.message : t('ocrFailed'))
    } finally {
      setOcrBusy(false)
      setOcrProgress(0)
    }
  }

  function updateItem(id: string, name: string) {
    setDraft((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name } : item)),
    )
    setApproved(false)
  }

  function removeItem(id: string) {
    setDraft((prev) => prev.filter((item) => item.id !== id))
    setApproved(false)
  }

  function addItem() {
    const name = newName.trim()
    if (!name) return
    setDraft((prev) => [...prev, { id: newCarteId(), name }].slice(0, 120))
    setNewName('')
    setApproved(false)
  }

  async function persist(nextApproved: boolean) {
    const cleaned = draft
      .map((item) => ({ ...item, name: item.name.trim() }))
      .filter((item) => item.name)
      .slice(0, 120)
    if (nextApproved && cleaned.length === 0) {
      setError(true)
      setMsg(t('carteNeedItems'))
      return
    }
    setBusy(true)
    setError(false)
    setMsg(null)
    try {
      await onSave(cleaned, nextApproved && cleaned.length > 0)
      setDraft(cleaned)
      setApproved(nextApproved && cleaned.length > 0)
      setMsg(nextApproved ? t('carteApprovedMsg') : t('carteSavedMsg'))
    } catch (err) {
      setError(true)
      setMsg(err instanceof Error ? err.message : t('carteSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel event-carte-editor">
      <div className="event-carte-head">
        <div>
          <h2>{t('eventCarte')}</h2>
          <p className="sub">{t('eventCarteSub')}</p>
        </div>
        <span
          className={`chip ${approved ? 'chip-warm' : 'chip-muted'}`}
        >
          {approved ? t('carteStatusApproved') : t('carteStatusDraft')}
        </span>
      </div>

      {!gathering.menuCardUrl && (
        <p className="sub">{t('carteNeedCard')}</p>
      )}

      {gathering.menuCardUrl && (
        <div className="form-actions" style={{ marginBottom: '0.85rem' }}>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            disabled={ocrBusy || busy}
            onClick={() => void runOcr()}
          >
            {ocrBusy
              ? t('ocrReading', { pct: ocrProgress })
              : draft.length
                ? t('ocrRefreshCarte')
                : t('ocrReadMenu')}
          </button>
        </div>
      )}

      {msg && (
        <div
          className={`feedback-banner ${error ? 'error' : ''}`}
          role="status"
          style={{ marginBottom: '0.75rem' }}
        >
          {msg}
        </div>
      )}

      {draft.length === 0 ? (
        <div className="empty">{t('carteEmptyEditor')}</div>
      ) : (
        <ul className="carte-edit-list">
          {draft.map((item, index) => (
            <li key={item.id}>
              <label className="carte-edit-row">
                <span className="carte-edit-index">{index + 1}</span>
                <input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, e.target.value)}
                  aria-label={t('carteItemName')}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeItem(item.id)}
                >
                  {t('remove')}
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="carte-add-row">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('carteAddPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem()
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
          {t('carteAddItem')}
        </button>
      </div>

      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void persist(false)}
        >
          {busy ? t('saving') : t('carteSaveDraft')}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          disabled={busy || draft.every((d) => !d.name.trim())}
          onClick={() => void persist(true)}
        >
          {t('carteApprove')}
        </button>
        {approved && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void persist(false)}
          >
            {t('carteUnapprove')}
          </button>
        )}
      </div>
    </section>
  )
}
