import { createWorker } from 'tesseract.js'

const OCR_CACHE_PREFIX = 'round-menu-ocr-v1:'

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

/** Turn raw OCR text into plausible menu dish lines. */
export function parseMenuLines(text: string): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\s+/g, ' ').trim()
    line = line.replace(/^[\-–—*•·]+\s*/, '')
    line = line.replace(/\s{2,}/g, ' ')
    if (line.length < 3 || line.length > 90) continue
    if (!/[A-Za-zÀ-ÿ]/.test(line)) continue
    if (/^[\d€$£.,\s/|-]+$/.test(line)) continue
    if (/^(menu|ementa|carta|page|página)\b/i.test(line)) continue
    // Drop pure price suffixes alone
    if (/^\d+[.,]\d{2}\s*€?$/.test(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
    if (lines.length >= 120) break
  }
  return lines
}

export async function ocrMenuImage(
  imageSource: string,
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  const worker = await createWorker('por+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const result = await worker.recognize(imageSource)
    return parseMenuLines(result.data.text || '')
  } finally {
    await worker.terminate()
  }
}
