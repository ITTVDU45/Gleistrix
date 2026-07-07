import { describe, it, expect } from 'vitest'
import { analyzeBoq } from '@/lib/gaeb/agent/analyzeBoq'
import type { GaebBillOfQuantities } from '@/types/gaeb'

function boq(partial: Partial<GaebBillOfQuantities>): GaebBillOfQuantities {
  return {
    _id: 'b1',
    importJobId: 'job1',
    version: '3.2',
    phase: 'X83',
    projectName: 'Testprojekt',
    currency: 'EUR',
    netSum: 1000,
    grossSum: undefined,
    positionCount: 0,
    createdAt: new Date().toISOString(),
    lots: [],
    ...partial,
  }
}

describe('analyzeBoq', () => {
  it('erkennt fehlende Preise und Gewerk-Cluster', () => {
    const data = boq({
      netSum: 350,
      lots: [
        {
          label: 'Los 1',
          titles: [
            {
              label: 'Verkehrssicherung',
              positions: [
                { ordinalNumber: '0010', type: 'normal', shortText: 'Absperrschranke reflektierend', quantity: 100, unit: 'm', price: { unitPrice: 3.5, totalPrice: 350, currency: 'EUR' } },
                { ordinalNumber: '0020', type: 'normal', shortText: 'Warnleuchte gelb', quantity: 10, unit: 'St' }, // ohne Preis
              ],
            },
          ],
        },
      ],
      positionCount: 2,
    })

    const a = analyzeBoq(data)
    expect(a.projectDraft?.positionCount).toBe(2)
    expect(a.missingData.some((m) => m.includes('ohne Preisangabe'))).toBe(true)
    expect(a.risks.some((r) => r.id === 'missing-prices')).toBe(true)
    expect(a.clusters.some((c) => c.label === 'Verkehrssicherung')).toBe(true)
    expect(a.resourceSuggestions?.some((s) => s.type === 'lagerartikel')).toBe(true)
  })

  it('erkennt Schicht-/Nachtarbeit', () => {
    const data = boq({
      lots: [{ label: 'L', titles: [{ label: 'T', positions: [{ ordinalNumber: '1', type: 'normal', shortText: 'Nachtschicht Sicherung', quantity: 8, unit: 'h', price: { totalPrice: 800, currency: 'EUR' } }] }] }],
      positionCount: 1,
    })
    const a = analyzeBoq(data)
    expect(a.risks.some((r) => r.id === 'shift')).toBe(true)
  })

  it('meldet leeres LV als Risiko', () => {
    const a = analyzeBoq(boq({ lots: [], positionCount: 0, netSum: 0 }))
    expect(a.risks.some((r) => r.id === 'no-positions')).toBe(true)
  })
})
