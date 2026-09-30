import { describe, expect, it } from 'vitest'
import { safeMediaUrl } from './safeUrl'

describe('safeMediaUrl', () => {
  it('allows http(s) image links', () => {
    expect(safeMediaUrl('https://cdn.example.com/menu.jpg')).toBe(
      'https://cdn.example.com/menu.jpg',
    )
    expect(safeMediaUrl('http://example.com/a.png')).toBe('')
  })

  it('allows approved data:image URLs', () => {
    const data = 'data:image/png;base64,abc'
    expect(safeMediaUrl(data)).toBe(data)
  })

  it('blocks javascript and credentialed URLs', () => {
    expect(safeMediaUrl('javascript:alert(1)')).toBe('')
    expect(safeMediaUrl('https://user:pass@evil.com/x')).toBe('')
    expect(safeMediaUrl('data:text/html;base64,xx')).toBe('')
    expect(safeMediaUrl('')).toBe('')
    expect(safeMediaUrl(null)).toBe('')
  })
})
