import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nContext'
import { formatMoney } from '../lib/money'
import {
  loadCachedOcrLines,
  ocrMenuImage,
  saveCachedOcrLines,
} from '../lib/menuOcr'
import type { Gathering } from '../types'

type Props = {
  gathering: Gathering
  compact?: boolean
  /** Called when OCR lines are available (cached or freshly read). */
  onOcrLines?: (lines: string[]) => void
  /** Persist OCR lines to the server when provided. */
  saveOcrLines?: (lines: string[]) => Promise<void>
}

let bodyLockCount = 0

function lockBody() {
  bodyLockCount += 1
  if (bodyLockCount === 1) {
    document.body.dataset.menuSheetOpen = '1'
    document.body.style.overflow = 'hidden'
  }
}

function unlockBody() {
  bodyLockCount = Math.max(0, bodyLockCount - 1)
  if (bodyLockCount === 0) {
    delete document.body.dataset.menuSheetOpen
    document.body.style.overflow = ''
  }
}

export function MenuSheet({
  gathering,
  compact = false,
  onOcrLines,
  saveOcrLines,
}: Props) {
  const { t, localeTag } = useI18n()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrLines, setOcrLines] = useState<string[]>(() => {
    if (gathering.menuOcrLines?.length) return gathering.menuOcrLines
    if (gathering.menuCardUrl) return loadCachedOcrLines(gathering.menuCardUrl) || []
    return []
  })
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const hasCard = Boolean(gathering.menuCardUrl)
  const hasItems = gathering.menu.length > 0

  useEffect(() => {
    if (gathering.menuOcrLines?.length) {
      setOcrLines(gathering.menuOcrLines)
      onOcrLines?.(gathering.menuOcrLines)
      return
    }
    if (gathering.menuCardUrl) {
      const cached = loadCachedOcrLines(gathering.menuCardUrl)
      if (cached?.length) {
        setOcrLines(cached)
        onOcrLines?.(cached)
      }
    }
  }, [gathering.menuCardUrl, gathering.menuOcrLines, onOcrLines])

  useEffect(() => {
    if (!open) return
    lockBody()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockBody()
    }
  }, [open])

  useEffect(() => {
    if (!open) setZoom(1)
  }, [open])

  async function runOcr() {
    if (!gathering.menuCardUrl || ocrBusy) return
    setOcrBusy(true)
    setOcrError(null)
    setOcrProgress(0)
    try {
      const lines = await ocrMenuImage(gathering.menuCardUrl, setOcrProgress)
      if (lines.length === 0) {
        setOcrError(t('ocrNoText'))
      } else {
        setOcrLines(lines)
        saveCachedOcrLines(gathering.menuCardUrl, lines)
        onOcrLines?.(lines)
        if (saveOcrLines) {
          await saveOcrLines(lines)
        }
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : t('ocrFailed'))
    } finally {
      setOcrBusy(false)
      setOcrProgress(0)
    }
  }

  function close() {
    setOpen(false)
  }

  if (!hasCard && !hasItems) return null

  const sheet = open
    ? createPortal(
        <div className="menu-sheet-backdrop" role="presentation">
          <div
            ref={sheetRef}
            className="menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="menu-sheet-head">
              <div>
                <h2 id={titleId}>{t('menuSheetTitle')}</h2>
                <p className="sub">{t('menuSheetSub')}</p>
              </div>
              <button type="button" className="btn btn-accent btn-sm" onClick={close}>
                {t('menuSheetClose')}
              </button>
            </div>

            <div className="menu-sheet-body">
              {hasCard && (
                <div className="menu-sheet-card">
                  <div className="menu-zoom-toolbar">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                      disabled={zoom <= 0.5}
                    >
                      {t('zoomOut')}
                    </button>
                    <span className="menu-zoom-label">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                      disabled={zoom >= 3}
                    >
                      {t('zoomIn')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setZoom(1)}
                    >
                      {t('zoomReset')}
                    </button>
                  </div>

                  <div className="menu-zoom-viewport">
                    <img
                      src={gathering.menuCardUrl}
                      alt={t('menuCard')}
                      className="menu-zoom-image"
                      style={{ transform: `scale(${zoom})` }}
                      draggable={false}
                    />
                  </div>

                  <div className="menu-ocr-actions">
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      disabled={ocrBusy}
                      onClick={() => void runOcr()}
                    >
                      {ocrBusy
                        ? t('ocrReading', { pct: ocrProgress })
                        : t('ocrReadMenu')}
                    </button>
                    {!gathering.menuCardUrl.startsWith('data:') && (
                      <a
                        className="btn btn-ghost btn-sm"
                        href={gathering.menuCardUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('menuCardOpen')}
                      </a>
                    )}
                  </div>

                  {ocrError && (
                    <p className="allergy" role="alert">
                      {ocrError}
                    </p>
                  )}
                  {ocrLines.length > 0 && (
                    <div className="menu-ocr-preview">
                      <p className="sub">
                        {t('ocrFound', { count: ocrLines.length })}
                      </p>
                      <ul>
                        {ocrLines.slice(0, 8).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                        {ocrLines.length > 8 && (
                          <li>… +{ocrLines.length - 8}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {hasItems && (
                <div className="menu-sheet-list">
                  <h3>{t('currentMenu')}</h3>
                  <ul>
                    {gathering.menu.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          {item.isAlaCarte && (
                            <>
                              {' '}
                              <span className="chip chip-warm">{t('alaCarte')}</span>
                            </>
                          )}
                          <p>
                            {item.category}
                            {item.description ? ` · ${item.description}` : ''}
                          </p>
                        </div>
                        <span className="price">
                          {item.isAlaCarte
                            ? t('priceVariable')
                            : formatMoney(item.price, gathering.currency, localeTag)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        type="button"
        className={`btn ${compact ? 'btn-ghost btn-sm' : 'btn-ghost'} menu-peek-btn`}
        onClick={() => setOpen(true)}
      >
        {t('checkMenu')}
      </button>
      {sheet}
    </>
  )
}
