import { describe, expect, it } from 'vitest'
import { detectDayShift, detectEntryShift } from './projectColors'

describe('detectEntryShift', () => {
  it('erkennt einen Eintrag im Fenster 05:00–12:00 als Frühschicht', () => {
    expect(detectEntryShift('2026-07-22T05:00', '2026-07-22T12:00')).toBe('tag')
    expect(detectEntryShift('2026-07-22T07:00', '2026-07-22T11:30')).toBe('tag')
  })

  it('erkennt einen Start vor 05:00 als Nachtschicht', () => {
    expect(detectEntryShift('2026-07-22T04:30', '2026-07-22T10:00')).toBe('nacht')
  })

  it('erkennt ein Ende nach 12:00 als Nachtschicht', () => {
    expect(detectEntryShift('2026-07-22T06:00', '2026-07-22T14:00')).toBe('nacht')
    expect(detectEntryShift('2026-07-22T13:00', '2026-07-22T17:00')).toBe('nacht')
  })

  it('erkennt einen Eintrag über Mitternacht als Nachtschicht', () => {
    expect(detectEntryShift('2026-07-22T22:00', '2026-07-23T06:00')).toBe('nacht')
  })

  it('fällt ohne Startzeit auf Frühschicht zurück', () => {
    expect(detectEntryShift(undefined, '2026-07-22T10:00')).toBe('tag')
  })
})

describe('detectDayShift', () => {
  it('markiert den Tag als Nachtschicht, sobald ein Eintrag Nachtschicht ist', () => {
    const entries = [
      { start: '2026-07-22T06:00', ende: '2026-07-22T11:00' },
      { start: '2026-07-22T13:00', ende: '2026-07-22T18:00' },
    ]
    expect(detectDayShift(entries)).toBe('nacht')
  })

  it('bleibt Frühschicht, wenn alle Einträge im Fenster liegen', () => {
    const entries = [
      { start: '2026-07-22T05:00', ende: '2026-07-22T09:00' },
      { start: '2026-07-22T09:30', ende: '2026-07-22T12:00' },
    ]
    expect(detectDayShift(entries)).toBe('tag')
  })
})
