import { describe, test, expect } from 'vitest'
import { calculateWorkHoursFromTimes } from './calculateTimeValues'
import { buildTimeEntry } from './buildTimeEntry'

const baseParams = {
  name: 'Test Mitarbeiter',
  funktion: 'SIPO',
  day: '2026-07-23',
  startTime: '07:00',
  endTime: '16:00',
  pause: '0,5',
  extra: '0',
  fahrtstunden: '0',
  bemerkung: '',
  isMultiDay: false,
  isHoliday: false,
  isSunday: false
}

describe('calculateWorkHoursFromTimes', () => {
  test('zieht die Pause von der Zeitspanne ab', () => {
    expect(calculateWorkHoursFromTimes('07:00', '16:00', '0,5')).toBe(8.5)
  })

  test('wertet Endzeit <= Startzeit als Schicht über Mitternacht', () => {
    expect(calculateWorkHoursFromTimes('22:00', '06:00', '0')).toBe(8)
  })

  test('gibt 0 zurück bei fehlenden oder ungültigen Zeiten', () => {
    expect(calculateWorkHoursFromTimes('', '16:00', '0')).toBe(0)
    expect(calculateWorkHoursFromTimes('07:00', 'abc', '0')).toBe(0)
  })

  test('wird nie negativ, auch bei zu großer Pause', () => {
    expect(calculateWorkHoursFromTimes('07:00', '08:00', '3')).toBe(0)
  })
})

describe('buildTimeEntry mit manuellen Arbeitsstunden', () => {
  test('berechnet ohne manuellen Wert aus Start/Ende/Pause', () => {
    const entry = buildTimeEntry(baseParams)
    expect(entry.stunden).toBe(8.5)
    expect(entry.stundenManuell).toBe(false)
  })

  test('übernimmt den manuellen Wert und markiert den Eintrag', () => {
    const entry = buildTimeEntry({ ...baseParams, manualHours: 6 })
    expect(entry.stunden).toBe(6)
    expect(entry.stundenManuell).toBe(true)
  })

  test('negativer manueller Wert wird auf 0 begrenzt', () => {
    expect(buildTimeEntry({ ...baseParams, manualHours: -3 }).stunden).toBe(0)
  })

  test('Nachtzulage bleibt aus den Zeiten berechnet, nicht aus den manuellen Stunden', () => {
    const auto = buildTimeEntry({ ...baseParams, startTime: '22:00', endTime: '23:59' })
    const manual = buildTimeEntry({ ...baseParams, startTime: '22:00', endTime: '23:59', manualHours: 1 })
    expect(manual.nachtzulage).toBe(auto.nachtzulage)
  })

  test('Feiertagsstunden bleiben aus den Zeiten berechnet, nicht aus den manuellen Stunden', () => {
    const auto = buildTimeEntry({ ...baseParams, isHoliday: true })
    const manual = buildTimeEntry({ ...baseParams, isHoliday: true, manualHours: 14 })
    expect(auto.feiertag).toBe(9) // 8,5 h gerundet
    expect(manual.feiertag).toBe(auto.feiertag)
    expect(manual.stunden).toBe(14)
  })

  test('Sonntagsstunden bleiben aus den Zeiten berechnet', () => {
    // 2026-07-26 ist ein Sonntag
    const sonntag = { ...baseParams, day: '2026-07-26', isSunday: true }
    const auto = buildTimeEntry(sonntag)
    const manual = buildTimeEntry({ ...sonntag, manualHours: 2 })
    expect(auto.sonntagsstunden).toBe(9)
    expect(manual.sonntagsstunden).toBe(auto.sonntagsstunden)
  })
})
