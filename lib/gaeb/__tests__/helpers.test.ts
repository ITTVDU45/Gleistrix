import { describe, it, expect } from 'vitest'
import { toArray, getNested, extractText, parseNumber } from '@/lib/gaeb/xml/gaebXmlHelpers'

describe('parseNumber', () => {
  it('interpretiert deutsche und englische Dezimaltrennung', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('1234,56')).toBe(1234.56)
    expect(parseNumber('3.50')).toBe(3.5)
    expect(parseNumber('100')).toBe(100)
    expect(parseNumber(42)).toBe(42)
  })
  it('liefert undefined bei ungültigen Werten', () => {
    expect(parseNumber('')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
    expect(parseNumber(undefined)).toBeUndefined()
    expect(parseNumber(null)).toBeUndefined()
  })
})

describe('toArray', () => {
  it('normalisiert Einzelwert/Array/leer', () => {
    expect(toArray('x')).toEqual(['x'])
    expect(toArray(['a', 'b'])).toEqual(['a', 'b'])
    expect(toArray(undefined)).toEqual([])
    expect(toArray(null)).toEqual([])
  })
})

describe('getNested', () => {
  it('liest verschachtelte Pfade sicher', () => {
    const obj = { A: { B: { C: 5 } } }
    expect(getNested(obj, 'A', 'B', 'C')).toBe(5)
    expect(getNested(obj, 'A', 'X')).toBeUndefined()
    expect(getNested(undefined, 'A')).toBeUndefined()
  })
})

describe('extractText', () => {
  it('extrahiert Text aus verschachtelten Knoten und ignoriert Attribute', () => {
    const node = { p: { span: 'Absperrschranke', '@_id': 'x1' } }
    expect(extractText(node)).toContain('Absperrschranke')
    expect(extractText(node)).not.toContain('x1')
  })
  it('verbindet mehrere Textteile', () => {
    const node = { p: [{ span: 'Teil A' }, { span: 'Teil B' }] }
    const text = extractText(node)
    expect(text).toContain('Teil A')
    expect(text).toContain('Teil B')
  })
})
