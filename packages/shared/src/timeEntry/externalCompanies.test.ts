import { describe, expect, test } from 'vitest'
import { computeExternalCompanyIds, externalCompanyIdsEqual } from './externalCompanies'

describe('computeExternalCompanyIds', () => {
  test('sammelt eindeutige externalCompanyIds über alle Tage', () => {
    const zeiten = {
      '2026-07-01': [
        { id: 'a', name: 'Intern', stunden: 8 },
        { id: 'b', isExternal: true, externalCompanyId: 'c2', externalCount: 2 },
      ],
      '2026-07-02': [
        { id: 'c', isExternal: true, externalCompanyId: 'c1' },
        { id: 'd', isExternal: true, externalCompanyId: 'c2' },
      ],
    }
    expect(computeExternalCompanyIds(zeiten)).toEqual(['c1', 'c2'])
  })

  test('ignoriert interne Einträge, leere IDs und kaputte Strukturen', () => {
    const zeiten = {
      '2026-07-01': [
        { id: 'a', isExternal: true, externalCompanyId: '' },
        { id: 'b', isExternal: true },
        { id: 'c', isExternal: false, externalCompanyId: 'sollte-nicht-zaehlen' },
        null,
      ],
      '2026-07-02': 'kein-array',
    }
    expect(computeExternalCompanyIds(zeiten as never)).toEqual([])
  })

  test('leere/fehlende Disposition ergibt leere Liste', () => {
    expect(computeExternalCompanyIds(undefined)).toEqual([])
    expect(computeExternalCompanyIds(null)).toEqual([])
    expect(computeExternalCompanyIds({})).toEqual([])
  })
})

describe('externalCompanyIdsEqual', () => {
  test('vergleicht unabhängig von der Reihenfolge', () => {
    expect(externalCompanyIdsEqual(['b', 'a'], ['a', 'b'])).toBe(true)
    expect(externalCompanyIdsEqual(['a'], ['a', 'b'])).toBe(false)
    expect(externalCompanyIdsEqual(undefined, [])).toBe(false)
    expect(externalCompanyIdsEqual([], [])).toBe(true)
  })
})
