import { describe, expect, test } from 'vitest'
import { aggregateProjectStats, type ProjectWithStatus } from './projectStats'

const projekt = (status: string, mitarbeiterZeiten = {}) => ({ status, mitarbeiterZeiten })

describe('aggregateProjectStats', () => {
  test('zählt Projekte je Status', () => {
    const stats = aggregateProjectStats([
      projekt('aktiv'),
      projekt('aktiv'),
      projekt('abgeschlossen'),
      projekt('fertiggestellt'),
      projekt('geleistet'),
      projekt('pausiert'),
    ])

    expect(stats.gesamt).toBe(6)
    expect(stats.aktiv).toBe(2)
    expect(stats.abgeschlossen).toBe(3)
  })

  test('normalisiert Status (Groß-/Kleinschreibung und Leerzeichen)', () => {
    const stats = aggregateProjectStats([projekt(' Aktiv '), projekt('ABGESCHLOSSEN')])

    expect(stats.aktiv).toBe(1)
    expect(stats.abgeschlossen).toBe(1)
  })

  test('summiert die Gesamtstunden über alle Projekte', () => {
    const stats = aggregateProjectStats([
      projekt('aktiv', {
        '2026-01-05': [
          { name: 'Max', funktion: 'SIPO', start: '08:00', end: '16:00', stunden: 8, pause: 0 },
        ],
      }),
      projekt('aktiv', {
        '2026-01-06': [
          { name: 'Erika', funktion: 'HFE', start: '08:00', end: '12:00', stunden: 4, pause: 0 },
        ],
      }),
    ])

    expect(stats.totalStunden).toBe(12)
  })

  test('liefert Nullwerte für leere oder fehlende Listen', () => {
    const leer = { gesamt: 0, aktiv: 0, abgeschlossen: 0, totalStunden: 0 }

    expect(aggregateProjectStats([])).toEqual(leer)
    expect(aggregateProjectStats(undefined as unknown as ProjectWithStatus[])).toEqual(leer)
  })

  test('behandelt Projekte ohne Status als weder aktiv noch abgeschlossen', () => {
    const stats = aggregateProjectStats([{ status: null }, {}])

    expect(stats.gesamt).toBe(2)
    expect(stats.aktiv).toBe(0)
    expect(stats.abgeschlossen).toBe(0)
  })
})
