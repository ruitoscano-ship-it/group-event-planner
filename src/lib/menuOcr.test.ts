import { describe, expect, it } from 'vitest'
import { cacheKeyForMenu, menuCardKind, parseMenuLines } from './menuOcr'

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

  it('strips trailing prices from dish names', () => {
    expect(parseMenuLines('Sopa do dia 3,50 €\nBife 18.00')).toEqual([
      'Sopa do dia',
      'Bife',
    ])
  })

  it('dedupes case-insensitively and caps length', () => {
    const lines = parseMenuLines('Soup\nsoup\nSOUP')
    expect(lines).toEqual(['Soup'])
  })

  it('drops section headers and low-letter garbage', () => {
    expect(parseMenuLines('Entradas\n###\nSalada mista')).toEqual(['Salada mista'])
  })
})

describe('cacheKeyForMenu', () => {
  it('namespaces by url prefix and length', () => {
    const key = cacheKeyForMenu('https://example.com/menu.jpg')
    expect(key.startsWith('round-menu-ocr-v2:')).toBe(true)
    expect(key).toContain(String('https://example.com/menu.jpg'.length))
  })
})

describe('menuCardKind', () => {
  it('labels data urls and hosts', () => {
    expect(menuCardKind('data:image/jpeg;base64,abc')).toBe('data:jpeg')
    expect(menuCardKind('https://cdn.example.com/a.jpg')).toBe('cdn.example.com')
  })
})
