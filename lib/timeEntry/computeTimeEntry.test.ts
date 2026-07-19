import { describe, test, expect } from 'vitest'
import { computeTimeEntry, minutesToHours } from './computeTimeEntry'

// Hinweis: ISO-Strings bewusst OHNE 'Z', damit sie als lokale Zeit geparst
// werden – so sind Dauer und Nacht/Sonntag-Prädikate zeitzonenunabhängig.

describe('minutesToHours', () => {
  test('rechnet volle Stunden korrekt', () => {
    expect(minutesToHours(60)).toBe(1)
    expect(minutesToHours(120)).toBe(2)
  })

  test('rundet auf zwei Dezimalstellen', () => {
    expect(minutesToHours(90)).toBe(1.5)
    expect(minutesToHours(30)).toBe(0.5)
    expect(minutesToHours(10)).toBe(0.17)
  })

  test('gibt 0 für 0 Minuten zurück', () => {
    expect(minutesToHours(0)).toBe(0)
  })
})

describe('computeTimeEntry – automatische Pausen (deutsche Regel)', () => {
  test('Schicht bis 5h → keine Pflichtpause', () => {
    // Montag, 08:00–12:00 = 240 min
    const result = computeTimeEntry({
      startISO: '2026-07-13T08:00:00',
      endISO: '2026-07-13T12:00:00',
      holidays: [],
    })
    expect(result.totalDurationMinutes).toBe(240)
    expect(result.breakTotalMinutes).toBe(0)
    expect(result.paidDurationMinutes).toBe(240)
  })

  test('Schicht >5h bis 9h → 30 min Pause', () => {
    // Montag, 08:00–16:30 = 510 min
    const result = computeTimeEntry({
      startISO: '2026-07-13T08:00:00',
      endISO: '2026-07-13T16:30:00',
      holidays: [],
    })
    expect(result.totalDurationMinutes).toBe(510)
    expect(result.breakTotalMinutes).toBe(30)
    expect(result.paidDurationMinutes).toBe(480)
    expect(minutesToHours(result.paidDurationMinutes)).toBe(8)
  })

  test('Schicht >9h bis 10h → 45 min Pause', () => {
    // Montag, 07:00–17:30 = 630 min → aber Pause richtet sich nach Gesamtdauer
    const result = computeTimeEntry({
      startISO: '2026-07-13T08:00:00',
      endISO: '2026-07-13T17:45:00', // 585 min → >540, ≤600 → 45 min
      holidays: [],
    })
    expect(result.totalDurationMinutes).toBe(585)
    expect(result.breakTotalMinutes).toBe(45)
    expect(result.paidDurationMinutes).toBe(540)
  })
})

describe('computeTimeEntry – manuelle Pausen', () => {
  test('overrideBreaks nutzt die übergebenen Pausensegmente', () => {
    const result = computeTimeEntry({
      startISO: '2026-07-13T08:00:00',
      endISO: '2026-07-13T16:00:00', // 480 min
      holidays: [],
      overrideBreaks: true,
      manualBreaks: [{ start: '2026-07-13T12:00:00', end: '2026-07-13T12:15:00' }],
    })
    expect(result.overrideBreaks).toBe(true)
    expect(result.breakTotalMinutes).toBe(15)
    expect(result.paidDurationMinutes).toBe(465)
  })
})

describe('computeTimeEntry – Zuschläge', () => {
  test('reine Tagschicht werktags erzeugt nur Normalminuten', () => {
    const result = computeTimeEntry({
      startISO: '2026-07-13T08:00:00',
      endISO: '2026-07-13T16:30:00',
      holidays: [],
    })
    expect(result.premiums.sundayMinutes).toBe(0)
    expect(result.premiums.holidayMinutes).toBe(0)
    // Normalminuten = bezahlte Minuten, da keine Zuschläge greifen
    expect(result.premiums.normalMinutes).toBe(result.paidDurationMinutes)
  })

  test('Sonntagsarbeit erzeugt Sonntagsminuten', () => {
    // 2026-07-12 ist ein Sonntag
    const result = computeTimeEntry({
      startISO: '2026-07-12T09:00:00',
      endISO: '2026-07-12T13:00:00',
      holidays: [],
    })
    expect(result.premiums.sundayMinutes).toBeGreaterThan(0)
  })
})
