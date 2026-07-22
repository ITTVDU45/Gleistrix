import { describe, expect, it } from 'vitest'
import {
  ISLAMIC_HOLIDAY_COVERAGE,
  ISLAMIC_HOLIDAY_DATES,
  ISLAMIC_HOLIDAY_LENGTHS,
  type IslamicHolidayId,
} from './islamicHolidayDates'
import { getIslamicHolidaysInRange, isCoveredByIslamicHolidayData } from './islamicHolidays'
import { fromDateKey } from './dateUtils'

const DAY_MS = 86_400_000

function daysBetween(aKey: string, bKey: string): number {
  return (fromDateKey(bKey).getTime() - fromDateKey(aKey).getTime()) / DAY_MS
}

function firstDaysOf(id: IslamicHolidayId): string[] {
  return ISLAMIC_HOLIDAY_DATES.filter((e) => e.id === id && e.day === 1).map((e) => e.dateKey)
}

describe('getIslamicHolidaysInRange', () => {
  it('liefert die von DITIB veröffentlichten Tage für 2026', () => {
    const holidays = getIslamicHolidaysInRange('2026-01-01', '2026-12-31')
    expect(holidays.map((h) => h.dateKey)).toEqual([
      '2026-02-19',
      '2026-03-20',
      '2026-03-21',
      '2026-03-22',
      '2026-05-27',
      '2026-05-28',
      '2026-05-29',
      '2026-05-30',
    ])
  })

  it('benennt die Tage mehrtägiger Feste einzeln', () => {
    const holidays = getIslamicHolidaysInRange('2026-03-20', '2026-03-22')
    expect(holidays.map((h) => h.name)).toEqual([
      'Ramadanfest (1. Tag)',
      'Ramadanfest (2. Tag)',
      'Ramadanfest (3. Tag)',
    ])
  })

  it('bezeichnet den Ramadanbeginn ohne Tageszählung', () => {
    const [beginn] = getIslamicHolidaysInRange('2026-02-19', '2026-02-19')
    expect(beginn.name).toBe('Ramadanbeginn')
  })

  it('grenzt inklusive beider Randtage ab', () => {
    expect(getIslamicHolidaysInRange('2026-03-20', '2026-03-20')).toHaveLength(1)
    expect(getIslamicHolidaysInRange('2026-03-23', '2026-05-26')).toHaveLength(0)
  })

  it('enthält beide Ramadananfänge des Jahres 2030', () => {
    const beginn = getIslamicHolidaysInRange('2030-01-01', '2030-12-31').filter(
      (h) => h.definitionId === 'ramadanbeginn'
    )
    expect(beginn.map((h) => h.dateKey)).toEqual(['2030-01-05', '2030-12-26'])
  })

  it('liefert außerhalb des gepflegten Zeitraums nichts, statt zu raten', () => {
    expect(getIslamicHolidaysInRange('2035-01-01', '2035-12-31')).toEqual([])
    expect(getIslamicHolidaysInRange('2019-01-01', '2019-12-31')).toEqual([])
  })

  it('meldet, ob ein Zeitraum von den Daten abgedeckt ist', () => {
    expect(isCoveredByIslamicHolidayData('2026-01-01', '2026-12-31')).toBe(true)
    expect(isCoveredByIslamicHolidayData('2031-06-01', '2032-06-01')).toBe(false)
    expect(isCoveredByIslamicHolidayData('2024-12-01', '2025-02-01')).toBe(false)
  })

  it('setzt das Datum auf UTC-Mitternacht des Schlüssels', () => {
    const [beginn] = getIslamicHolidaysInRange('2026-02-19', '2026-02-19')
    expect(beginn.date.toISOString()).toBe('2026-02-19T00:00:00.000Z')
  })
})

// Diese Prüfungen validieren die gepflegte Tabelle selbst: ein Tippfehler in
// einem der Daten verletzt zwangsläufig eine der Kalenderregeln.
describe('Datenintegrität der DITIB-Tabelle', () => {
  it('führt die Einträge lückenlos aufsteigend', () => {
    const keys = ISLAMIC_HOLIDAY_DATES.map((e) => e.dateKey)
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys.map((k, i) => `${k}-${ISLAMIC_HOLIDAY_DATES[i].id}`)).size).toBe(keys.length)
  })

  it('hält jeden Eintrag innerhalb des angegebenen Zeitraums', () => {
    for (const entry of ISLAMIC_HOLIDAY_DATES) {
      expect(entry.dateKey >= ISLAMIC_HOLIDAY_COVERAGE.fromDateKey).toBe(true)
      expect(entry.dateKey <= ISLAMIC_HOLIDAY_COVERAGE.toDateKey).toBe(true)
    }
  })

  it('führt jedes Fest mit vollständigen, aufeinanderfolgenden Tagen', () => {
    for (const [id, length] of Object.entries(ISLAMIC_HOLIDAY_LENGTHS)) {
      const entries = ISLAMIC_HOLIDAY_DATES.filter((e) => e.id === id)
      for (let i = 0; i < entries.length; i += 1) {
        const expectedDay = (i % length) + 1
        expect(`${entries[i].dateKey}:${entries[i].day}`).toBe(`${entries[i].dateKey}:${expectedDay}`)
        if (expectedDay > 1) {
          expect(daysBetween(entries[i - 1].dateKey, entries[i].dateKey)).toBe(1)
        }
      }
    }
  })

  it('legt das Ramadanfest 29 oder 30 Tage nach den Ramadanbeginn', () => {
    // Der Ramadan hat 29 oder 30 Tage; das Fest beginnt am Tag danach.
    for (const beginn of firstDaysOf('ramadanbeginn')) {
      const fest = firstDaysOf('ramadanfest').find((k) => k > beginn)
      if (!fest) continue // letzter Ramadan reicht über den Zeitraum hinaus
      expect([29, 30]).toContain(daysBetween(beginn, fest))
    }
  })

  it('legt das Opferfest 68 bis 70 Tage nach das Ramadanfest', () => {
    // 1. Schawwal -> 10. Zilhicce: zwei Mondmonate (je 29/30 Tage) plus 9 Tage.
    for (const fest of firstDaysOf('ramadanfest')) {
      const opfer = firstDaysOf('opferfest').find((k) => k > fest)
      if (!opfer) continue
      const distance = daysBetween(fest, opfer)
      expect(distance).toBeGreaterThanOrEqual(67)
      expect(distance).toBeLessThanOrEqual(70)
    }
  })
})
