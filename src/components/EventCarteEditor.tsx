import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { api } from '../lib/api'
import {
  loadCachedOcrLines,
  menuCardKind,
  ocrMenuImage,
  saveCachedOcrLines,
} from '../lib/menuOcr'
import type { CarteItem, Gathering } from '../types'

type Props = {
  gathering: Gathering
  onSave: (items: CarteItem[], approved: boolean) => Promise<void>
}

function newCarteId(): string {
  return `carte_${crypto.randomUUID().replace(/-/g, '')}`
}

function fromLines(lines: string[]): CarteItem[] {
  return lines
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: newCarteId(), name }))
}

export function EventCarteEditor({ gathering, onSave }: Props) {
  const { t, locale } = useI18n()
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

  function reportOcr(payload: {
    status: 'success' | 'no_text' | 'error'
    errorMessage?: string
    lineCount?: number
    durationMs?: number
  }) {
    void api
      .reportOcrEvent(gathering.id, {
        ...payload,
        menuCardKind: menuCardKind(gathering.menuCardUrl || ''),
        clientLocale: locale,
      })
      .catch(() => {
        // logging must never block the organizer
      })
  }

  async function runOcr() {
    if (!gathering.menuCardUrl || ocrBusy) return
    setOcrBusy(true)
    setError(false)
    setMsg(null)
    setOcrProgress(0)
    try {
      const preferCache = draft.length === 0
      const cached = preferCache ? loadCachedOcrLines(gathering.menuCardUrl) : null
      if (cached && cached.length > 0) {
        const existing = new Set(draft.map((d) => d.name.toLowerCase()))
        const additions = fromLines(cached).filter(
          (item) => !existing.has(item.name.toLowerCase()),
        )
        setDraft((prev) => [...prev, ...additions].slice(0, 120))
        setApproved(false)
        setMsg(t('ocrFoundCached', { count: cached.length }))
        reportOcr({
          status: 'success',
          lineCount: cached.length,
          durationMs: 0,
          errorMessage: 'served-from-cache',
        })
        return
      }

      const result = await ocrMenuImage(gathering.menuCardUrl, setOcrProgress)
      if (result.status !== 'success' || result.lines.length === 0) {
        setError(true)
        setMsg(result.status === 'error' ? t('ocrFailed') : t('ocrNoText'))
        reportOcr({
          status: result.status === 'error' ? 'error' : 'no_text',
          errorMessage: result.errorMessage,
          lineCount: 0,
          durationMs: result.durationMs,
        })
        return
      }
      saveCachedOcrLines(gathering.menuCardUrl, result.lines)
      const existing = new Set(draft.map((d) => d.name.toLowerCase()))
      const additions = fromLines(result.lines).filter(
        (item) => !existing.has(item.name.toLowerCase()),
      )
      setDraft((prev) => [...prev, ...additions].slice(0, 120))
      setApproved(false)
      setMsg(t('ocrFound', { count: result.lines.length }))
      reportOcr({
        status: 'success',
        lineCount: result.lines.length,
        durationMs: result.durationMs,
      })
    } catch (err) {
      setError(true)
      setMsg(t('ocrFailed'))
      reportOcr({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'OCR failed',
      })
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
        <span className={`chip ${approved ? 'chip-warm' : 'chip-muted'}`}>
          {approved ? t('carteStatusApproved') : t('carteStatusDraft')}
        </span>
      </div>

      {!gathering.menuCardUrl && <p className="sub">{t('carteNeedCard')}</p>}

      {gathering.menuCardUrl && (
        <div className="form-actions stack-mb-sm">
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
          className={`feedback-banner stack-mb-sm ${error ? 'error' : ''}`}
          role="status"
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

      <div className="form-actions stack-mt">
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
