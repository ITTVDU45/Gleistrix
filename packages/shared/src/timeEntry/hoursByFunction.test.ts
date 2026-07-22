import { describe, expect, test } from 'vitest'
import { aggregateHoursByFunction, formatFunctionHours } from './hoursByFunction'

describe('aggregateHoursByFunction', () => {
  test('summiert interne Einträge je Funktion', () => {
    const { rows, totalStunden, totalExtra } = aggregateHoursByFunction([
      { funktion: 'SIPO', stunden: 8, extra: 1 },
      { funktion: 'SIPO', stunden: 4, extra: 0 },
      { funktion: 'HFE', stunden: 6, extra: 2 },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ funktion: 'SIPO', stunden: 12, extra: 1, eintraege: 2 })
    expect(totalStunden).toBe(18)
    expect(totalExtra).toBe(3)
  })

  test('multipliziert externe Einträge mit der Personenanzahl', () => {
    const { totalStunden, totalExtra } = aggregateHoursByFunction([
      { funktion: 'SAKRA', stunden: 8, extra: 1, isExternal: true, externalCount: 3 },
    ])

    // 8 Std pro Person * 3 Personen – nicht 8 * 3 * 3.
    expect(totalStunden).toBe(24)
    expect(totalExtra).toBe(3)
  })

  test('ignoriert externalCount bei internen Einträgen', () => {
    const { totalStunden } = aggregateHoursByFunction([
      { funktion: 'SIPO', stunden: 8, isExternal: false, externalCount: 5 },
    ])

    expect(totalStunden).toBe(8)
  })

  test('behandelt fehlende oder ungültige Werte als 0', () => {
    const { rows, totalStunden } = aggregateHoursByFunction([
      { funktion: null, stunden: null, extra: undefined },
      { funktion: '  ', stunden: 'keine Zahl' },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].funktion).toBe('Ohne Funktion')
    expect(totalStunden).toBe(0)
  })

  test('akzeptiert Komma-Dezimalzahlen als String', () => {
    const { totalStunden } = aggregateHoursByFunction([{ funktion: 'HFE', stunden: '7,5' }])

    expect(totalStunden).toBe(7.5)
  })

  test('sortiert Funktionen absteigend nach Stunden', () => {
    const { rows } = aggregateHoursByFunction([
      { funktion: 'A', stunden: 2 },
      { funktion: 'B', stunden: 9 },
      { funktion: 'C', stunden: 5 },
    ])

    expect(rows.map((row) => row.funktion)).toEqual(['B', 'C', 'A'])
  })
})

describe('formatFunctionHours', () => {
  test('formatiert Dezimalstunden als H:MM', () => {
    expect(formatFunctionHours(8.5)).toBe('8:30')
    expect(formatFunctionHours(0)).toBe('0:00')
    expect(formatFunctionHours(12326.35)).toBe('12326:21')
  })

  test('rundet 59,7 Minuten auf die volle Stunde', () => {
    expect(formatFunctionHours(2.9999)).toBe('3:00')
  })
})
