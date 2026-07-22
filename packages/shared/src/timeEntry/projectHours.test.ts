import { describe, expect, test } from 'vitest'
import { getProjectTotalHours } from './projectHours'
import { CONTINUATION_MARKER } from './billingRows'

describe('getProjectTotalHours', () => {
  test('summiert die Stunden aller Tage', () => {
    const total = getProjectTotalHours({
      mitarbeiterZeiten: {
        '2026-01-05': [{ name: 'Max', funktion: 'SIPO', stunden: 8 }],
        '2026-01-06': [
          { name: 'Max', funktion: 'SIPO', stunden: 8 },
          { name: 'Erika', funktion: 'HFE', stunden: 4 },
        ],
      },
    })

    expect(total).toBe(20)
  })

  test('multipliziert externe Einträge mit der Personenanzahl', () => {
    const total = getProjectTotalHours({
      mitarbeiterZeiten: {
        '2026-01-05': [
          { name: 'Fremdfirma', funktion: 'SAKRA', stunden: 8, isExternal: true, externalCount: 4 },
        ],
      },
    })

    expect(total).toBe(32)
  })

  test('zählt Fortsetzungszeilen nicht mit', () => {
    const total = getProjectTotalHours({
      mitarbeiterZeiten: {
        '2026-01-05': [{ name: 'Max', funktion: 'SIPO', stunden: 10 }],
        '2026-01-06': [
          { name: 'Max', funktion: 'SIPO', stunden: 10, bemerkung: CONTINUATION_MARKER },
        ],
      },
    })

    // Die Stunden der Nachtschicht stecken bereits im Eintrag vom 05.01.
    expect(total).toBe(10)
  })

  test('liefert 0 ohne Zeiteinträge', () => {
    expect(getProjectTotalHours({})).toBe(0)
    expect(getProjectTotalHours({ mitarbeiterZeiten: {} })).toBe(0)
  })
})
