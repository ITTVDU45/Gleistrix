import { describe, test, expect } from 'vitest'
import {
  getCustomHolidaysForPlantafel,
  getGermanHolidaysForPlantafel,
  holidaysToPlantafelEvents,
  type CustomHolidayRecord,
} from './holidayService'

const YEAR_2026 = { from: '2026-01-01', to: '2026-12-31' }

function record(partial: Partial<CustomHolidayRecord>): CustomHolidayRecord {
  return { _id: 'x', date: '2026-01-01', name: 'Test', bundesland: 'ALL', ...partial }
}

describe('getGermanHolidaysForPlantafel', () => {
  test('liefert bundesweite und regionale Feiertage ohne Filter', () => {
    const holidays = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to)
    const namen = holidays.map((h) => h.name)

    expect(namen).toContain('Neujahr') // bundesweit
    expect(namen).toContain('Fronleichnam') // regional
    expect(namen).toContain('Buß- und Bettag') // nur Sachsen
    expect(namen).toContain('Augsburger Hohes Friedensfest') // nur teilregional
  })

  test('kennzeichnet regionale Feiertage im Titel', () => {
    const holidays = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to)

    expect(holidays.find((h) => h.name === 'Neujahr')?.title).toBe('Neujahr')
    expect(holidays.find((h) => h.name === 'Allerheiligen')?.title).toBe(
      'Allerheiligen (BW, BY, NW, RP, SL)'
    )
  })

  test('Bundesland-Filter grenzt auf die gewählten Länder ein', () => {
    const nurNrw = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to, ['NW'])
    const namen = nurNrw.map((h) => h.name)

    expect(namen).toContain('Fronleichnam')
    expect(namen).not.toContain('Buß- und Bettag')
    expect(namen).not.toContain('Heilige Drei Könige')
  })

  test('teilregionale Feiertage lassen sich ausblenden', () => {
    const ohne = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to, ['BY'], false)
    expect(ohne.map((h) => h.name)).not.toContain('Augsburger Hohes Friedensfest')
  })
})

describe('getCustomHolidaysForPlantafel', () => {
  const computed = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to)

  test('verwirft Altbestand, der einen gesetzlichen Feiertag doppelt abbildet', () => {
    const records = [
      record({ _id: '1', date: '2026-01-01', name: 'Neujahr', bundesland: 'ALL' }),
      record({ _id: '2', date: '2026-06-04', name: 'Fronleichnam', bundesland: 'NW' }),
    ]

    expect(getCustomHolidaysForPlantafel(records, computed)).toEqual([])
  })

  test('erkennt Duplikate auch bei abweichender Schreibweise', () => {
    const records = [
      record({ _id: '1', date: '2026-12-25', name: '1. Weihnachtsfeiertag', bundesland: 'ALL' }),
    ]

    expect(getCustomHolidaysForPlantafel(records, computed)).toEqual([])
  })

  test('behält echte betriebliche Zusatztage', () => {
    const records = [
      record({ _id: '1', date: '2026-12-24', name: 'Betriebsruhe', bundesland: 'ALL' }),
    ]

    const result = getCustomHolidaysForPlantafel(records, computed)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Betriebsruhe (betrieblich)')
    expect(result[0].type).toBe('custom')
  })

  test('behält landesspezifische Zusatztage, die dort kein gesetzlicher Feiertag sind', () => {
    // Fronleichnam ist in Berlin kein gesetzlicher Feiertag – ein Eintrag für
    // BE an diesem Tag ist also ein echter betrieblicher Zusatztag.
    const records = [
      record({ _id: '1', date: '2026-06-04', name: 'Brückentag', bundesland: 'BE' }),
    ]

    expect(getCustomHolidaysForPlantafel(records, computed)).toHaveLength(1)
  })

  test('respektiert den Bundesland-Filter, bundesweite Einträge gelten immer', () => {
    const records = [
      record({ _id: '1', date: '2026-12-24', name: 'Betriebsruhe Bayern', bundesland: 'BY' }),
      record({ _id: '2', date: '2026-12-24', name: 'Betriebsruhe bundesweit', bundesland: 'ALL' }),
    ]

    const nurNrw = getCustomHolidaysForPlantafel(records, computed, ['NW'])
    expect(nurNrw.map((h) => h.name)).toEqual(['Betriebsruhe bundesweit'])
  })
})

describe('holidaysToPlantafelEvents', () => {
  test('färbt bundesweite und regionale Feiertage unterschiedlich', () => {
    const holidays = getGermanHolidaysForPlantafel(YEAR_2026.from, YEAR_2026.to)
    const events = holidaysToPlantafelEvents(holidays)

    const neujahr = events.find((e) => e.title === 'Neujahr')
    const allerheiligen = events.find((e) => e.title?.startsWith('Allerheiligen'))

    expect(neujahr?.color).toBe('#b45309')
    expect(allerheiligen?.color).toBe('#c2410c')
    expect(neujahr?.color).not.toBe(allerheiligen?.color)
  })

  test('übernimmt Geltungsbereich und Länder in das Event', () => {
    const events = holidaysToPlantafelEvents(
      getGermanHolidaysForPlantafel('2026-06-04', '2026-06-04')
    )
    const fronleichnam = events[0]

    expect(fronleichnam.holidayNationwide).toBe(false)
    expect(fronleichnam.holidayStates).toEqual(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'])
    expect(fronleichnam.holidayPartialStates).toEqual(['SN', 'TH'])
    expect(fronleichnam.notes).toContain('katholisch')
  })

  test('Events liegen auf dem lokalen Kalendertag des Feiertags', () => {
    const events = holidaysToPlantafelEvents(
      getGermanHolidaysForPlantafel('2026-10-03', '2026-10-03')
    )

    expect(events[0].start.getDate()).toBe(3)
    expect(events[0].start.getMonth()).toBe(9)
    expect(events[0].end.getDate()).toBe(3)
    expect(events[0].allDay).toBe(true)
  })
})
