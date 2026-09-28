import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  busy?: boolean
  onFile: (file: File | null) => void
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

export function ImageUploadDropzone({ busy = false, onFile }: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const mobile = useIsMobile()

  function pickFile(file: File | null) {
    if (!file || busy) return
    if (!file.type.startsWith('image/')) return
    onFile(file)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="image-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        disabled={busy}
        onChange={onChange}
      />
      <button
        type="button"
        className={`image-upload-zone ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={onDrop}
      >
        <span className="image-upload-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V5m0 0 3.5 3.5M12 5 8.5 8.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="image-upload-title">
          {busy
            ? t('menuCardUploading')
            : mobile
              ? t('menuCardDropTitleMobile')
              : t('menuCardDropTitle')}
        </span>
        <span className="image-upload-hint">
          {mobile ? t('menuCardDropHintMobile') : t('menuCardDropHint')}
        </span>
      </button>
    </div>
  )
}
