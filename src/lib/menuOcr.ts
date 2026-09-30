import { createWorker } from 'tesseract.js'

const OCR_CACHE_PREFIX = 'round-menu-ocr-v2:'
const MAX_OCR_EDGE = 1800

export type OcrStatus = 'success' | 'no_text' | 'error'

export type OcrRunResult = {
  lines: string[]
  rawText: string
  durationMs: number
  status: OcrStatus
  errorMessage?: string
}

export function cacheKeyForMenu(url: string): string {
  return `${OCR_CACHE_PREFIX}${url.slice(0, 120)}:${url.length}`
}

export function loadCachedOcrLines(menuCardUrl: string): string[] | null {
  try {
    const raw = localStorage.getItem(cacheKeyForMenu(menuCardUrl))
    if (!raw) return null
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null
  } catch {
    return null
  }
}

export function saveCachedOcrLines(menuCardUrl: string, lines: string[]) {
  try {
    localStorage.setItem(cacheKeyForMenu(menuCardUrl), JSON.stringify(lines))
  } catch {
    // ignore quota
  }
}

export function menuCardKind(url: string): string {
  if (url.startsWith('data:image/')) {
    const match = /^data:image\/([a-z0-9+.-]+);/i.exec(url)
    return match ? `data:${match[1].toLowerCase()}` : 'data'
  }
  try {
    return new URL(url).hostname || 'https'
  } catch {
    return 'unknown'
  }
}

/** Turn raw OCR text into plausible menu dish lines. */
export function parseMenuLines(text: string): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\s+/g, ' ').trim()
    line = line.replace(/^[\-–—*•·▪▫◦]+\s*/, '')
    line = line.replace(/\s*[\-–—|:·]+\s*$/, '')
    // Strip trailing prices: "Bacalhau 12,50 €" → "Bacalhau"
    line = line.replace(
      /\s+(?:€\s*)?\d{1,3}(?:[.,]\d{2})?\s*(?:€|euros?)?$/i,
      '',
    )
    line = line.replace(/\s{2,}/g, ' ').trim()
    if (line.length < 3 || line.length > 100) continue
    if (!/[A-Za-zÀ-ÿ]/.test(line)) continue
    if (/^[\d€$£.,\s/|%-]+$/.test(line)) continue
    if (/^\d+[.,]\d{2}\s*€?$/.test(line)) continue
    if (
      /^(menu|ementa|carta|page|página|entradas?|pratos?|sobremesas?|bebidas?|drinks?|desserts?|starters?|mains?|total|iva|tax|cover)\b/i.test(
        line,
      )
    ) {
      continue
    }
    // Drop lines that are mostly punctuation / OCR garbage
    const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length
    if (letters < 3) continue
    if (letters / line.length < 0.35) continue

    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
    if (lines.length >= 120) break
  }
  return lines
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    if (!source.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load menu image for OCR'))
    img.src = source
  })
}

/** Grayscale + contrast preprocess; returns a JPEG data URL Tesseract can read reliably. */
export async function prepareImageForOcr(source: string): Promise<string> {
  const img = await loadImageElement(source)
  const scale = Math.min(1, MAX_OCR_EDGE / Math.max(img.naturalWidth, img.naturalHeight, 1))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return source
  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  // Grayscale + mild contrast stretch
  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = data[i + 1] = data[i + 2] = y
    if (y < min) min = y
    if (y > max) max = y
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((data[i] - min) / range) * 255
    const contrasted = Math.max(0, Math.min(255, (stretched - 128) * 1.25 + 128))
    data[i] = data[i + 1] = data[i + 2] = contrasted
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function recognizeWithPsm(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: string,
  psm: number,
): Promise<string> {
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm) as never,
    preserve_interword_spaces: '1',
  })
  const result = await worker.recognize(image)
  return result.data.text || ''
}

export async function ocrMenuImage(
  imageSource: string,
  onProgress?: (pct: number) => void,
): Promise<OcrRunResult> {
  const started = performance.now()
  let prepared = imageSource
  try {
    prepared = await prepareImageForOcr(imageSource)
    onProgress?.(8)
  } catch {
    // Fall back to original source if canvas preprocess fails (e.g. CORS on remote URL)
    prepared = imageSource
  }

  const worker = await createWorker('por+eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
    logger: (m) => {
      if (typeof m.progress === 'number') {
        const base = m.status === 'recognizing text' ? 20 : 8
        const span = m.status === 'recognizing text' ? 75 : 12
        onProgress?.(Math.min(99, Math.round(base + m.progress * span)))
      }
    },
  })

  try {
    // PSM 6 = assume a uniform block of text (typical menu photo)
    let rawText = await recognizeWithPsm(worker, prepared, 6)
    let lines = parseMenuLines(rawText)
    // Fallback: sparse text / single column (PSM 4) if first pass is empty
    if (lines.length === 0) {
      onProgress?.(55)
      rawText = await recognizeWithPsm(worker, prepared, 4)
      lines = parseMenuLines(rawText)
    }
    onProgress?.(100)
    const durationMs = Math.round(performance.now() - started)
    if (lines.length === 0) {
      return {
        lines: [],
        rawText,
        durationMs,
        status: 'no_text',
        errorMessage: 'No readable dish lines parsed from OCR text',
      }
    }
    return { lines, rawText, durationMs, status: 'success' }
  } catch (err) {
    return {
      lines: [],
      rawText: '',
      durationMs: Math.round(performance.now() - started),
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'OCR failed',
    }
  } finally {
    await worker.terminate()
  }
}
