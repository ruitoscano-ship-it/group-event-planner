import { describe, expect, it } from 'vitest'
import { cacheKeyForMenu, parseMenuLines } from './menuOcr'

describe('parseMenuLines', () => {
  it('keeps plausible dish lines and drops noise', () => {
    const text = `
Menu
---
Bacalhau à Brás
12,50 €
Carta
• Arroz de pato
xx
123
`
    expect(parseMenuLines(text)).toEqual([
      'Bacalhau à Brás',
      'Arroz de pato',
    ])
  })

  it('dedupes case-insensitively and caps length', () => {
    const lines = parseMenuLines('Soup\nsoup\nSOUP')
    expect(lines).toEqual(['Soup'])
  })
})

describe('cacheKeyForMenu', () => {
  it('namespaces by url prefix and length', () => {
    const key = cacheKeyForMenu('https://example.com/menu.jpg')
    expect(key.startsWith('round-menu-ocr-v1:')).toBe(true)
    expect(key).toContain(String('https://example.com/menu.jpg'.length))
  })
})
