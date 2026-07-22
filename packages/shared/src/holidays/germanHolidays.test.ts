import { describe, test, expect } from 'vitest'
import {
  getEasterSunday,
  getBussUndBettag,
  toDateKey,
} from './dateUtils'
import {
  getGermanHolidaysForYear,
  getGermanHolidaysInRange,
  getGermanHolidayDateKeys,
  formatHolidayScope,
} from './germanHolidays'
import { GERMAN_STATE_CODES } from './germanStates'

/** Findet einen Feiertag eines Jahres über seine Definitions-ID. */
function find(year: number, definitionId: string) {
  return getGermanHolidaysForYear(year).find((h) => h.definitionId === definitionId)
}

describe('getEasterSunday', () => {
  // Referenzwerte nach dem gregorianischen Osterdatum.
  test.each([
    [2020, '2020-04-12'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
  ])('Ostersonntag %i ist %s', (year, expected) => {
    expect(toDateKey(getEasterSunday(year))).toBe(expected)
  })
})

describe('getBussUndBettag', () => {
  // Immer der Mittwoch vor dem 23. November.
  test.each([
    [2024, '2024-11-20'],
    [2025, '2025-11-19'],
    [2026, '2026-11-18'],
    [2027, '2027-11-17'],
  ])('Buß- und Bettag %i ist %s', (year, expected) => {
    const date = getBussUndBettag(year)
    expect(toDateKey(date)).toBe(expected)
    expect(date.getUTCDay()).toBe(3)
  })
})

describe('bundesweite Feiertage', () => {
  test('liefert alle neun bundesweiten Feiertage 2026', () => {
    const nationwide = getGermanHolidaysForYear(2026).filter((h) => h.nationwide)

    expect(nationwide.map((h) => `${h.dateKey} ${h.name}`)).toEqual([
      '2026-01-01 Neujahr',
      '2026-04-03 Karfreitag',
      '2026-04-06 Ostermontag',
      '2026-05-01 Tag der Arbeit',
      '2026-05-14 Christi Himmelfahrt',
      '2026-05-25 Pfingstmontag',
      '2026-10-03 Tag der Deutschen Einheit',
      '2026-12-25 1. Weihnachtstag',
      '2026-12-26 2. Weihnachtstag',
    ])
  })

  test('bundesweite Feiertage gelten in allen 16 Ländern', () => {
    const neujahr = find(2026, 'neujahr')
    expect(neujahr?.states).toEqual([...GERMAN_STATE_CODES])
    expect(formatHolidayScope(neujahr!)).toBe('bundesweit')
  })
})

describe('regionale Feiertage', () => {
  test('Heilige Drei Könige nur in BW, BY, ST', () => {
    const holiday = find(2026, 'heilige-drei-koenige')
    expect(holiday?.dateKey).toBe('2026-01-06')
    expect(holiday?.states).toEqual(['BW', 'BY', 'ST'])
    expect(holiday?.nationwide).toBe(false)
  })

  test('Fronleichnam liegt 60 Tage nach Ostern und gilt teilweise in SN und TH', () => {
    const holiday = find(2026, 'fronleichnam')
    expect(holiday?.dateKey).toBe('2026-06-04')
    expect(holiday?.states).toEqual(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'])
    expect(holiday?.partialStates).toEqual(['SN', 'TH'])
    expect(holiday?.note).toContain('katholisch')
  })

  test('Allerheiligen nur in BW, BY, NW, RP, SL', () => {
    const holiday = find(2026, 'allerheiligen')
    expect(holiday?.dateKey).toBe('2026-11-01')
    expect(holiday?.states).toEqual(['BW', 'BY', 'NW', 'RP', 'SL'])
  })

  test('Mariä Himmelfahrt landesweit im Saarland, teilweise in Bayern', () => {
    const holiday = find(2026, 'mariae-himmelfahrt')
    expect(holiday?.dateKey).toBe('2026-08-15')
    expect(holiday?.states).toEqual(['SL'])
    expect(holiday?.partialStates).toEqual(['BY'])
  })

  test('Ostersonntag und Pfingstsonntag sind nur in Brandenburg gesetzlich', () => {
    expect(find(2026, 'ostersonntag')?.states).toEqual(['BB'])
    expect(find(2026, 'ostersonntag')?.dateKey).toBe('2026-04-05')
    expect(find(2026, 'pfingstsonntag')?.states).toEqual(['BB'])
    expect(find(2026, 'pfingstsonntag')?.dateKey).toBe('2026-05-24')
  })

  test('Augsburger Friedensfest gilt nur im Stadtgebiet Augsburg', () => {
    const holiday = find(2026, 'augsburger-friedensfest')
    expect(holiday?.dateKey).toBe('2026-08-08')
    expect(holiday?.states).toEqual([])
    expect(holiday?.partialStates).toEqual(['BY'])
    expect(holiday?.note).toContain('Augsburg')
  })
})

describe('zeitlich begrenzte Regelungen', () => {
  test('Frauentag: Berlin ab 2019, MV erst ab 2023', () => {
    expect(find(2018, 'internationaler-frauentag')).toBeUndefined()
    expect(find(2019, 'internationaler-frauentag')?.states).toEqual(['BE'])
    expect(find(2022, 'internationaler-frauentag')?.states).toEqual(['BE'])
    expect(find(2023, 'internationaler-frauentag')?.states).toEqual(['BE', 'MV'])
  })

  test('Weltkindertag in Thüringen ab 2019', () => {
    expect(find(2018, 'weltkindertag')).toBeUndefined()
    expect(find(2026, 'weltkindertag')?.states).toEqual(['TH'])
    expect(find(2026, 'weltkindertag')?.dateKey).toBe('2026-09-20')
  })

  test('Reformationstag: Nordländer ab 2018, 2017 einmalig bundesweit', () => {
    expect(find(2016, 'reformationstag')?.states).toEqual(['BB', 'MV', 'SN', 'ST', 'TH'])
    expect(find(2017, 'reformationstag')?.nationwide).toBe(true)
    expect(find(2018, 'reformationstag')?.states).toEqual([
      'BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH',
    ])
  })

  test('Tag der Befreiung in Berlin nur 2020 und 2025', () => {
    expect(find(2020, 'tag-der-befreiung')?.states).toEqual(['BE'])
    expect(find(2021, 'tag-der-befreiung')).toBeUndefined()
    expect(find(2024, 'tag-der-befreiung')).toBeUndefined()
    expect(find(2025, 'tag-der-befreiung')?.states).toEqual(['BE'])
    expect(find(2026, 'tag-der-befreiung')).toBeUndefined()
  })

  test('Buß- und Bettag: bis 1994 bundesweit, danach nur Sachsen', () => {
    expect(find(1994, 'buss-und-bettag')?.nationwide).toBe(true)
    expect(find(1995, 'buss-und-bettag')?.states).toEqual(['SN'])
    expect(find(2026, 'buss-und-bettag')?.states).toEqual(['SN'])
  })
})

describe('Bundesland-Filter', () => {
  test('Bayern hat 2026 dreizehn Feiertage inklusive teilregionaler', () => {
    const bayern = getGermanHolidaysForYear(2026, { states: ['BY'] })

    expect(bayern.map((h) => h.name)).toEqual([
      'Neujahr',
      'Heilige Drei Könige',
      'Karfreitag',
      'Ostermontag',
      'Tag der Arbeit',
      'Christi Himmelfahrt',
      'Pfingstmontag',
      'Fronleichnam',
      'Augsburger Hohes Friedensfest',
      'Mariä Himmelfahrt',
      'Tag der Deutschen Einheit',
      'Allerheiligen',
      '1. Weihnachtstag',
      '2. Weihnachtstag',
    ])
  })

  test('includePartial: false blendet nur teilregional gültige Tage aus', () => {
    const mitTeilregional = getGermanHolidaysForYear(2026, { states: ['BY'] })
    const ohneTeilregional = getGermanHolidaysForYear(2026, {
      states: ['BY'],
      includePartial: false,
    })

    const namen = ohneTeilregional.map((h) => h.name)
    expect(namen).not.toContain('Augsburger Hohes Friedensfest')
    expect(namen).not.toContain('Mariä Himmelfahrt')
    expect(mitTeilregional.length).toBe(ohneTeilregional.length + 2)
  })

  test('Berlin hat 2026 nur zehn gesetzliche Feiertage', () => {
    const berlin = getGermanHolidaysForYear(2026, { states: ['BE'] })
    expect(berlin.map((h) => h.name)).toEqual([
      'Neujahr',
      'Internationaler Frauentag',
      'Karfreitag',
      'Ostermontag',
      'Tag der Arbeit',
      'Christi Himmelfahrt',
      'Pfingstmontag',
      'Tag der Deutschen Einheit',
      '1. Weihnachtstag',
      '2. Weihnachtstag',
    ])
  })

  test('mehrere Länder werden vereinigt, nicht geschnitten', () => {
    const beideLaender = getGermanHolidaysForYear(2026, { states: ['BY', 'BE'] })
    const namen = beideLaender.map((h) => h.name)

    expect(namen).toContain('Heilige Drei Könige') // nur BY
    expect(namen).toContain('Internationaler Frauentag') // nur BE
  })

  test('leerer Filter liefert alle Länder', () => {
    expect(getGermanHolidaysForYear(2026, { states: [] }).length).toBe(
      getGermanHolidaysForYear(2026).length
    )
  })
})

describe('getGermanHolidaysInRange', () => {
  test('begrenzt exakt auf den Zeitraum (Grenzen inklusive)', () => {
    const range = getGermanHolidaysInRange('2026-12-25', '2026-12-26')
    expect(range.map((h) => h.dateKey)).toEqual(['2026-12-25', '2026-12-26'])
  })

  test('überspannt Jahresgrenzen', () => {
    const range = getGermanHolidaysInRange('2026-12-24', '2027-01-02')
    expect(range.map((h) => h.dateKey)).toEqual(['2026-12-25', '2026-12-26', '2027-01-01'])
  })

  test('liefert nichts, wenn Start nach Ende liegt', () => {
    expect(getGermanHolidaysInRange('2026-06-01', '2026-05-01')).toEqual([])
  })

  test('ist sortiert und frei von Duplikaten pro Definition', () => {
    const range = getGermanHolidaysInRange('2026-01-01', '2026-12-31')
    const keys = range.map((h) => h.dateKey)
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(range.map((h) => h.id)).size).toBe(range.length)
  })

  test('wirft bei ungültigem Datumsformat', () => {
    expect(() => getGermanHolidaysInRange('01.01.2026', '2026-12-31')).toThrow(/YYYY-MM-DD/)
  })
})

describe('getGermanHolidayDateKeys', () => {
  test('liefert eindeutige, sortierte Datumsschlüssel', () => {
    // Fronleichnam (BW) und Ostersonntag (BB) fallen nie zusammen, aber
    // mehrere Länder können denselben Tag liefern – daher Deduplizierung.
    const keys = getGermanHolidayDateKeys('2026-01-01', '2026-12-31')
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual(keys)
    expect(keys).toContain('2026-05-14') // Christi Himmelfahrt
  })

  test('respektiert den Bundesland-Filter', () => {
    const nrw = getGermanHolidayDateKeys('2026-01-01', '2026-12-31', { states: ['NW'] })
    expect(nrw).toContain('2026-06-04') // Fronleichnam
    expect(nrw).not.toContain('2026-01-06') // Heilige Drei Könige gilt nicht in NRW
  })
})

describe('Zeitzonen-Stabilität', () => {
  test('Datumsschlüssel bleibt unabhängig von der lokalen Zeitzone korrekt', () => {
    // Die Berechnung läuft in UTC; getUTC*-Werte müssen mit dem Schlüssel
    // übereinstimmen – auch wenn der Prozess in UTC+X oder UTC-X läuft.
    for (const holiday of getGermanHolidaysForYear(2026)) {
      const [y, m, d] = holiday.dateKey.split('-').map(Number)
      expect(holiday.date.getUTCFullYear()).toBe(y)
      expect(holiday.date.getUTCMonth() + 1).toBe(m)
      expect(holiday.date.getUTCDate()).toBe(d)
      expect(holiday.date.getUTCHours()).toBe(0)
    }
  })
})

describe('formatHolidayScope', () => {
  test('beschreibt bundesweite, regionale und teilregionale Geltung', () => {
    expect(formatHolidayScope(find(2026, 'neujahr')!)).toBe('bundesweit')
    expect(formatHolidayScope(find(2026, 'allerheiligen')!)).toBe('BW, BY, NW, RP, SL')
    expect(formatHolidayScope(find(2026, 'fronleichnam')!)).toBe(
      'BW, BY, HE, NW, RP, SL · teilweise SN, TH'
    )
    expect(formatHolidayScope(find(2026, 'augsburger-friedensfest')!)).toBe('teilweise BY')
  })
})
